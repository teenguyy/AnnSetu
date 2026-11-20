/* Delivery-app style pickup tracking: live map (OpenStreetMap via Leaflet, no card or key), route + ETA, confirmed steps, call / chat.
   Used by the donor, the receiver (NGO) and the representative. */
import React, { useEffect, useRef, useState } from 'react';
import { FiPhone, FiMessageSquare, FiNavigation, FiMapPin, FiCheck, FiTruck, FiPackage, FiHome, FiUser } from 'react-icons/fi';
import { db, ago } from './lib.js';
import { loadLeaflet, hasPoint, pt, km, route, TILES, ATTRIBUTION } from './maps.js';
import { Btn, useToast } from './ui.jsx';

export const STEPS = [
  ['assigned', 'Pickup confirmed', 'Representative assigned', FiUser],
  ['on_the_way', 'On the way', 'Trip started to the donor', FiTruck],
  ['arrived', 'Reached donor', 'At the pickup point', FiMapPin],
  ['collected', 'Food collected', 'OTP confirmed by the donor', FiPackage],
  ['delivered', 'Delivered', 'Handed over at the NGO', FiHome],
];
const ORDER = STEPS.map((s) => s[0]);
const STAMP = { assigned: 'created_at', on_the_way: 'trip_started_at', arrived: 'arrived_at', collected: 'collected_at', delivered: 'delivered_at' };
const tm = (d) => (d ? new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '');
export const telHref = (p) => 'tel:' + String(p || '').replace(/[^+\d]/g, '');

/* live location of the representative for one request (realtime + polling fallback) */
export function useRepLocation(requestId, active) {
  const [loc, setLoc] = useState(null);
  useEffect(() => {
    if (!requestId || !active) { setLoc(null); return undefined; }
    let alive = true;
    const load = async () => { const r = await db.from('rep_locations').select('lat,lng,updated_at').eq('request_id', requestId).maybeSingle(); if (alive && !r.error) setLoc(r.data); };
    load();
    let ch = null;
    try {
      ch = db.channel('loc-' + requestId)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rep_locations', filter: 'request_id=eq.' + requestId }, (p) => { if (alive && p.new && p.new.lat != null) setLoc(p.new); })
        .subscribe();
    } catch (e) {}
    const t = setInterval(load, 8000);
    return () => { alive = false; clearInterval(t); if (ch) db.removeChannel(ch); };
  }, [requestId, active]);
  return loc;
}

export function Steps({ request }) {
  const cur = Math.max(0, ORDER.indexOf(request.trip_status || 'assigned'));
  return (
    <ol className="lt-steps" aria-label="Pickup progress">
      {STEPS.map(([k, t, d, Ic], i) => (
        <li key={k} className={i < cur ? 'done' : i === cur ? 'now' : ''}>
          <span className="lt-ic">{i < cur ? <FiCheck /> : <Ic />}</span>
          <span className="lt-tx"><b>{t}</b><small>{i <= cur && request[STAMP[k]] ? tm(request[STAMP[k]]) : d}</small></span>
        </li>
      ))}
    </ol>
  );
}

/* The map. points: { rep, donor, ngo } ; target: 'donor' | 'ngo' */
function MapView({ rep, donor, ngo, target, onEta }) {
  const box = useRef(null);
  const st = useRef({});
  const [err, setErr] = useState('');
  useEffect(() => {
    let dead = false;
    loadLeaflet().then((L) => {
      if (dead || !box.current) return;
      const center = hasPoint(rep) ? pt(rep) : hasPoint(donor) ? pt(donor) : hasPoint(ngo) ? pt(ngo) : { lat: 20.59, lng: 78.96 };
      const map = L.map(box.current, { center: [center.lat, center.lng], zoom: 14, scrollWheelZoom: false, attributionControl: true });
      L.tileLayer(TILES, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);
      const pin = (cls, letter) => L.divIcon({ className: 'lt-pin ' + cls, html: '<span><b>' + letter + '</b></span>', iconSize: [30, 38], iconAnchor: [15, 38] });
      st.current = {
        L, map,
        donor: hasPoint(donor) ? L.marker([+donor.lat, +donor.lng], { icon: pin('d', 'D'), title: 'Pickup: ' + (donor.name || 'donor') }).addTo(map) : null,
        ngo: hasPoint(ngo) ? L.marker([+ngo.lat, +ngo.lng], { icon: pin('n', 'N'), title: 'Drop: ' + (ngo.name || 'NGO') }).addTo(map) : null,
        rep: null,
        line: L.polyline([], { color: '#164B70', weight: 5, opacity: 0.85 }).addTo(map),
        lastRoute: 0, lastFrom: null,
      };
      setErr('');
      update();
      setTimeout(() => map.invalidateSize(), 200);
    }).catch(() => !dead && setErr('The map could not load.'));
    return () => { dead = true; if (st.current.map) { st.current.map.remove(); st.current = {}; } };
  }, []); // eslint-disable-line

  const update = () => {
    const s = st.current; if (!s.map) return;
    const L = s.L;
    const dest = target === 'ngo' ? ngo : donor;
    const pts = [];
    [s.donor, s.ngo].forEach((m) => { if (m) pts.push(m.getLatLng()); });
    if (hasPoint(rep)) {
      const to = pt(rep);
      if (!s.rep) {
        s.rep = L.marker([to.lat, to.lng], { icon: L.divIcon({ className: 'lt-rep', html: '<i></i>', iconSize: [22, 22], iconAnchor: [11, 11] }), zIndexOffset: 900, title: 'Representative' }).addTo(s.map);
      } else { // glide smoothly to the new point
        const a = s.rep.getLatLng(), t0 = performance.now();
        const step = (t) => { const k = Math.min(1, (t - t0) / 900); s.rep.setLatLng([a.lat + (to.lat - a.lat) * k, a.lng + (to.lng - a.lng) * k]); if (k < 1) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      }
      pts.push(L.latLng(to.lat, to.lng));
      // road route + live ETA (at most every 45 s, or after moving ~250 m)
      if (hasPoint(dest)) {
        const moved = s.lastFrom ? km(s.lastFrom, to) : 99;
        if (Date.now() - s.lastRoute > 45000 || moved > 0.25) {
          s.lastRoute = Date.now(); s.lastFrom = to;
          route(to, pt(dest)).then((r) => { if (st.current.map) { s.line.setLatLngs(r.path); if (onEta) onEta(r); } });
        }
      }
    }
    if (pts.length > 1) s.map.fitBounds(L.latLngBounds(pts), { padding: [36, 36], maxZoom: 16 });
    else if (pts.length === 1) s.map.setView(pts[0], 15);
  };
  useEffect(update, [rep && rep.lat, rep && rep.lng, target]); // eslint-disable-line

  return (
    <div className="lt-map-wrap">
      <div ref={box} className="lt-map" role="img" aria-label="Live map of the pickup" />
      {err && <div className="lt-map-off"><FiMapPin /><span>{err} {hasPoint(rep) ? <a href={`https://www.google.com/maps/search/?api=1&query=${rep.lat},${rep.lng}`} target="_blank" rel="noopener noreferrer">Open live location</a> : null}</span></div>}
    </div>
  );
}

/* Full tracker card section. viewer: 'donor' | 'ngo' | 'rep' */
export function LiveTrack({ request, donor, ngo, viewer, onChat }) {
  const st = request.trip_status || 'assigned';
  const moving = request.status === 'accepted' || (request.status === 'completed' && st === 'collected');
  const loc = useRepLocation(request.id, moving && viewer !== 'rep');
  const [eta, setEta] = useState(null);
  const target = st === 'collected' ? 'ngo' : 'donor';
  const fresh = loc && Date.now() - new Date(loc.updated_at).getTime() < 120000;
  const headline = st === 'delivered' ? `Delivered to ${ngo?.name || 'the NGO'}`
    : st === 'collected' ? `Food collected · heading to ${ngo?.name || 'the NGO'}`
    : st === 'arrived' ? `${request.rep_name || 'The representative'} has reached the donor`
    : st === 'on_the_way' ? `${request.rep_name || 'The representative'} is on the way`
    : 'Waiting for the representative to start the trip';
  const etaTxt = eta && (st === 'on_the_way' || st === 'collected') ? `${eta.rough ? '~' : ''}${eta.mins} min · ${eta.km.toFixed(1)} km` : request.eta && st === 'on_the_way' ? 'ETA ' + tm(request.eta) : '';
  return (
    <div className="lt">
      <div className="lt-head">
        <div><b>{headline}</b>{etaTxt && <span className="lt-eta">{target === 'ngo' ? 'To NGO: ' : 'Arriving in '}{etaTxt}</span>}
          {viewer !== 'rep' && moving && <small className={'lt-live' + (fresh ? ' on' : '')}>{fresh ? <>● Live · updated {ago(new Date(loc.updated_at).getTime())}</> : 'Live location appears when the representative shares it'}</small>}</div>
      </div>
      {viewer !== 'rep' && moving && <MapView rep={loc} donor={donor} ngo={ngo} target={target} onEta={setEta} />}
      <Steps request={request} />
      <div className="lt-contact">
        {viewer !== 'rep' && request.rep_phone && <a className="btn sm primary" href={telHref(request.rep_phone)}><FiPhone /> Call {request.rep_name || 'representative'}</a>}
        {viewer !== 'donor' && donor?.phone && <a className="btn sm ghost" href={telHref(donor.phone)}><FiPhone /> Call donor</a>}
        {viewer !== 'ngo' && ngo?.phone && <a className="btn sm ghost" href={telHref(ngo.phone)}><FiPhone /> Call NGO</a>}
        {onChat && <Btn size="sm" kind="ghost" onClick={onChat}><FiMessageSquare /> Message</Btn>}
      </div>
    </div>
  );
}

/* Representative side: live map of their own position + step buttons + automatic location sharing. */
export function RepTrip({ p, onChanged, onChat }) {
  const toast = useToast();
  const [me, setMe] = useState(null);
  const [eta, setEta] = useState(null);
  const [sharing, setSharing] = useState(false);
  const watch = useRef(null);
  const sent = useRef(0);
  const st = p.trip_status || 'assigned';
  const moving = (p.status === 'accepted' && (st === 'on_the_way' || st === 'arrived')) || (p.status === 'completed' && st === 'collected');
  const stop = () => { if (watch.current != null && navigator.geolocation) navigator.geolocation.clearWatch(watch.current); watch.current = null; setSharing(false); };
  const start = () => {
    if (!navigator.geolocation) { toast('This device can’t share location.', 'bad'); return; }
    if (watch.current != null) return;
    watch.current = navigator.geolocation.watchPosition(async (pos) => {
      const c = { lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6) };
      setMe(c);
      if (Date.now() - sent.current < 4000) return;
      sent.current = Date.now();
      const r = await db.rpc('update_location', { p_request: p.id, p_lat: c.lat, p_lng: c.lng, p_acc: Math.round(pos.coords.accuracy || 0) });
      if (r.error) { toast(r.error.message, 'bad'); stop(); }
    }, () => { toast('Allow location access so the donor and NGO can track you.', 'bad'); stop(); }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 });
    setSharing(true);
  };
  // keep sharing automatically while the trip is active (like delivery apps)
  useEffect(() => { if (moving) start(); else stop(); return undefined; }, [moving]); // eslint-disable-line
  useEffect(() => stop, []); // eslint-disable-line

  const go = (status) => async () => {
    let etaIso = null;
    if (status === 'on_the_way') {
      const mins = eta ? eta.mins : 20;
      etaIso = new Date(Date.now() + mins * 6e4).toISOString();
    }
    const r = await db.rpc('set_trip_status', { p_request: p.id, p_status: status, p_eta: etaIso });
    if (r.error) { toast(r.error.message, 'bad'); return; }
    toast(status === 'on_the_way' ? 'Trip started. Donor and NGO can track you live.' : status === 'arrived' ? 'Donor and NGO notified: you have reached.' : 'Delivered! Thank you.');
    if (status === 'on_the_way') start();
    if (status === 'delivered') stop();
    if (onChanged) await onChanged();
  };
  const target = st === 'collected' ? 'ngo' : 'donor';
  return (
    <div className="lt">
      <div className="lt-head"><div>
        <b>{st === 'assigned' ? 'Ready when you are' : st === 'on_the_way' ? 'Heading to the donor' : st === 'arrived' ? 'Show the OTP to the donor' : st === 'collected' ? `Take the food to ${p.ngo_name}` : 'Delivered'}</b>
        {eta && (st === 'on_the_way' || st === 'collected') && <span className="lt-eta">{eta.rough ? '~' : ''}{eta.mins} min · {eta.km.toFixed(1)} km</span>}
        {moving && <small className={'lt-live' + (sharing ? ' on' : '')}>{sharing ? '● Sharing your live location' : 'Location sharing is off'}</small>}
      </div></div>
      {(moving || st === 'assigned') && <MapView rep={me} donor={p.donor} ngo={p.ngo} target={target} onEta={setEta} />}
      <Steps request={p} />
      <div className="lt-contact">
        {st === 'assigned' && p.status === 'accepted' && <Btn size="sm" onClick={go('on_the_way')}><FiNavigation /> Start trip</Btn>}
        {st === 'on_the_way' && <Btn size="sm" onClick={go('arrived')}><FiMapPin /> I’ve reached the donor</Btn>}
        {st === 'collected' && <Btn size="sm" onClick={go('delivered')}><FiHome /> Delivered to NGO</Btn>}
        {moving && !sharing && <Btn size="sm" kind="ghost" onClick={start}><FiNavigation /> Share live location</Btn>}
        {p.donor_phone && <a className="btn sm ghost" href={telHref(p.donor_phone)}><FiPhone /> Call donor</a>}
        {p.ngo_phone && <a className="btn sm ghost" href={telHref(p.ngo_phone)}><FiPhone /> Call NGO</a>}
        {onChat && <Btn size="sm" kind="ghost" onClick={onChat}><FiMessageSquare /> Message</Btn>}
      </div>
    </div>
  );
}
