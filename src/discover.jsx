import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { FiSearch, FiMove, FiPlus, FiX, FiClock, FiMapPin, FiPackage, FiLock, FiCheck, FiAlertTriangle, FiInbox } from 'react-icons/fi';
import { db, CATEGORIES, fmtDT, tleft, errMsg } from './lib.js';
import { need } from './data.js';
import { Btn, Empty, Skeleton, useToast } from './ui.jsx';
import { setCursorMode } from './cursor.js';

/* ---------- availability, computed only from real listing fields ---------- */
export const availableOf = (l) => Math.max(0, (l.quantity || 0) - (l.qty_reserved || 0));
export function availability(l) {
  const left = availableOf(l);
  const ms = new Date(l.pickup_by) - Date.now();
  if (ms <= 0 || left <= 0) return { key: 'gone', label: ms <= 0 ? 'Pickup window closed' : 'Fully reserved' };
  if (ms < 2 * 36e5) return { key: 'soon', label: 'Ending soon' };
  if (left / l.quantity <= 0.25) return { key: 'low', label: `Only ${left} left` };
  return { key: 'open', label: 'Available' };
}
const eligible = (l) => availability(l).key !== 'gone';
const CAT_MARK = { 'Cooked meals': 'CM', Bakery: 'BK', 'Packaged food': 'PK', 'Fruits & vegetables': 'FV', Dairy: 'DY' };

/* ---------- pointer-based drag and drop (mouse, pen and touch via the grip) ---------- */
function useDragToTray({ dropRef, onDrop, canDrop }) {
  const [drag, setDrag] = useState(null); // { listing, x, y, over }
  const st = useRef(null);
  const end = useCallback((commit) => {
    const s = st.current;
    st.current = null;
    document.documentElement.classList.remove('is-dragging');
    setCursorMode('');
    if (s && s.active && commit && s.over && canDrop(s.listing)) onDrop(s.listing);
    setDrag(null);
  }, [onDrop, canDrop]);

  useEffect(() => {
    const move = (e) => {
      const s = st.current;
      if (!s || e.pointerId !== s.id) return;
      const dx = e.clientX - s.x0, dy = e.clientY - s.y0;
      if (!s.active) {
        if (Math.hypot(dx, dy) < 6) return;
        s.active = true;
        document.documentElement.classList.add('is-dragging');
      }
      e.preventDefault();
      const r = dropRef.current && dropRef.current.getBoundingClientRect();
      const over = !!r && e.clientX >= r.left - 12 && e.clientX <= r.right + 12 && e.clientY >= r.top - 12 && e.clientY <= r.bottom + 12;
      s.over = over;
      setCursorMode(over && canDrop(s.listing) ? 'drop' : 'drag');
      setDrag({ listing: s.listing, x: e.clientX, y: e.clientY, over, ok: canDrop(s.listing) });
    };
    const up = (e) => { if (st.current && e.pointerId === st.current.id) end(true); };
    const cancel = () => end(false);
    const key = (e) => { if (e.key === 'Escape' && st.current) end(false); };
    addEventListener('pointermove', move, { passive: false });
    addEventListener('pointerup', up);
    addEventListener('pointercancel', cancel);
    addEventListener('keydown', key);
    return () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', cancel); removeEventListener('keydown', key); };
  }, [dropRef, canDrop, end]);

  const start = (listing) => (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const onGrip = !!e.target.closest('.grip');
    if (e.pointerType !== 'mouse' && !onGrip) return; // touch scrolls normally unless the grip is used
    if (!onGrip && e.target.closest('button, a, input, select, textarea, label')) return;
    st.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, listing, active: false, over: false };
  };
  return { drag, start };
}

/* ---------- a single listing ---------- */
function FoodCard({ l, i, inTray, canRequest, onAdd, onPointerDown, lifting, layout }) {
  const av = availability(l);
  const left = availableOf(l);
  const dragOk = canRequest && eligible(l) && !inTray;
  return (
    <motion.article layout={layout} className={'food ' + av.key + (lifting ? ' lifting' : '') + (inTray ? ' picked' : '')}
      initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.35, delay: Math.min(i, 8) * 0.03, ease: [0.2, 0.7, 0.1, 1] }}
      onPointerDown={dragOk ? onPointerDown : undefined} data-draggable={dragOk ? 'true' : undefined}
      aria-label={`${l.title}, ${left} ${l.unit} available`}>
      <div className="food-img">
        {l.photo ? <img src={l.photo} alt={`Photo of ${l.title}`} loading="lazy" decoding="async" />
          : <div className="food-ph" aria-hidden="true"><span>{CAT_MARK[l.category] || 'AS'}</span><small>{l.category}</small></div>}
        <span className={'avail ' + av.key}><i />{av.label}</span>
        {dragOk && <span className="grip" title="Drag into your request tray" aria-hidden="true"><FiMove /></span>}
      </div>
      <div className="food-b">
        <div className="food-cat">{l.category}</div>
        <h3>{l.title}</h3>
        <div className="food-qty"><b>{left}</b><span>of {l.quantity} {l.unit} available</span></div>
        <dl className="food-meta">
          <div><dt><FiClock aria-hidden="true" /><span className="sr">Pickup</span></dt><dd>{tleft(l.pickup_by)} · by {fmtDT(l.pickup_by)}</dd></div>
          <div><dt><FiPackage aria-hidden="true" /><span className="sr">Donor</span></dt><dd>{l.donor_name || 'Verified donor'}</dd></div>
          {(l.distance != null || l.donor_address || l.area) && (
            <div><dt><FiMapPin aria-hidden="true" /><span className="sr">Location</span></dt><dd>{l.distance != null ? `${Number(l.distance).toFixed(1)} km away` : l.donor_address || l.area}</dd></div>
          )}
        </dl>
        {l.safety_notes ? <p className="food-note">{l.safety_notes}</p> : null}
        {canRequest && (
          <button type="button" className={'food-add' + (inTray ? ' on' : '')} onClick={() => onAdd(l)} disabled={!eligible(l) || inTray}
            aria-label={inTray ? `${l.title} is in your request tray` : `Add ${l.title} to request tray`}>
            {inTray ? <><FiCheck aria-hidden="true" /> In tray</> : <><FiPlus aria-hidden="true" /> Add to request</>}
          </button>
        )}
      </div>
    </motion.article>
  );
}

/* ---------- request tray (drop target + accessible form) ---------- */
function Tray({ trayRef, items, setItems, reps, rep, setRep, ok, lockReason, hot, dragging, onSubmit, onClear, results }) {
  const update = (id, qty) => setItems((xs) => xs.map((x) => (x.l.id === id ? { ...x, qty } : x)));
  const remove = (id) => setItems((xs) => xs.filter((x) => x.l.id !== id));
  return (
    <aside ref={trayRef} data-dark className={'tray' + (hot ? ' hot' : '') + (dragging ? ' armed' : '') + (!ok ? ' locked' : '')} aria-label="Request tray" aria-live="polite">
      <div className="tray-h">
        <span className="kick">Request tray</span>
        <h3>{items.length ? `${items.length} listing${items.length > 1 ? 's' : ''} ready` : 'Drop food here'}</h3>
        <p className="m">{ok ? 'Drag a card here, or use “Add to request”. Nothing is sent until you confirm.' : lockReason}</p>
      </div>
      <svg className="tray-target" viewBox="0 0 120 60" aria-hidden="true">
        <path d="M6 54 Q60 -6 114 54" pathLength="1" /><circle cx="6" cy="54" r="4" /><circle cx="114" cy="54" r="4" />
      </svg>
      {items.length > 0 && (
        <ul className="tray-list">
          {items.map(({ l, qty }) => {
            const left = availableOf(l);
            const res = results[l.id];
            return (
              <li key={l.id} className={res ? 'res-' + res.s : ''}>
                <div className="tl-t"><b>{l.title}</b><small>{l.donor_name} · max {left} {l.unit}</small>
                  {res && <small className={'tl-r ' + res.s} role={res.s === 'bad' ? 'alert' : undefined}>{res.s === 'ok' ? <><FiCheck /> Request sent</> : <><FiAlertTriangle /> {res.m}</>}</small>}</div>
                <label className="tl-q"><span className="sr">Quantity for {l.title}</span>
                  <input type="number" min="1" max={left} value={qty} inputMode="numeric" onChange={(e) => update(l.id, e.target.value)} /></label>
                <button type="button" className="ib sm" onClick={() => remove(l.id)} aria-label={`Remove ${l.title} from tray`}><FiX /></button>
              </li>
            );
          })}
        </ul>
      )}
      {items.length > 0 && ok && (
        <div className="tray-f">
          <label className="field"><span className="lab">Pickup representative</span>
            <select value={rep} onChange={(e) => setRep(e.target.value)}>
              {reps.length ? reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>) : <option value="">No representatives yet</option>}
            </select></label>
          <div className="row-l">
            <Btn onClick={onSubmit} arrow>Send {items.length > 1 ? `${items.length} requests` : 'request'}</Btn>
            <Btn kind="ghost" onClick={onClear}>Clear</Btn>
          </div>
        </div>
      )}
    </aside>
  );
}

/* ---------- the board ---------- */
export function DiscoverBoard({ listings, error, reps = [], ok, lockReason, onRequested, controls, intro }) {
  const toast = useToast();
  const reduce = useReducedMotion();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [sort, setSort] = useState('soonest');
  const [items, setItems] = useState([]);
  const [rep, setRep] = useState(reps[0]?.id || '');
  const [results, setResults] = useState({});
  const trayRef = useRef(null);
  useEffect(() => { if (!rep && reps[0]) setRep(reps[0].id); }, [reps]); // eslint-disable-line

  const hasDistance = (listings || []).some((l) => l.distance != null);
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    let xs = (listings || []).filter((l) => (!cat || l.category === cat)
      && (!term || [l.title, l.donor_name, l.category, l.safety_notes].filter(Boolean).join(' ').toLowerCase().includes(term)));
    const by = {
      soonest: (a, b) => new Date(a.pickup_by) - new Date(b.pickup_by),
      most: (a, b) => availableOf(b) - availableOf(a),
      nearest: (a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9),
      newest: (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
    }[sort];
    return by ? xs.slice().sort(by) : xs;
  }, [listings, q, cat, sort]);

  const inTray = (id) => items.some((x) => x.l.id === id);
  const canDrop = useCallback((l) => !!ok && eligible(l) && !items.some((x) => x.l.id === l.id), [ok, items]);
  const add = useCallback((l) => {
    if (!ok) { toast(lockReason || 'Sign in as a verified receiver to request food.', 'info'); return; }
    if (!eligible(l)) { toast('This listing can no longer be requested.', 'bad'); return; }
    setItems((xs) => (xs.some((x) => x.l.id === l.id) ? xs : [...xs, { l, qty: Math.min(availableOf(l), 10) }]));
    setResults((r) => { const n = { ...r }; delete n[l.id]; return n; });
    toast(`${l.title} added to your request tray.`, 'info');
  }, [ok, lockReason, toast]);
  const { drag, start } = useDragToTray({ dropRef: trayRef, onDrop: add, canDrop });

  const submit = async () => {
    if (!ok) throw new Error(lockReason || 'Only verified receivers can request food.');
    if (!rep) throw new Error('Add a pickup representative first (Profile → Pickup representatives).');
    for (const { l, qty } of items) { // validate everything before sending anything
      const n = Math.floor(+qty), left = availableOf(l);
      if (!(n >= 1) || n > left) throw new Error(`Choose a quantity between 1 and ${left} for “${l.title}”.`);
    }
    const out = {};
    let sent = 0;
    for (const { l, qty } of items) {
      try { need(await db.rpc('create_request', { p_listing: l.id, p_qty: Math.floor(+qty), p_rep: rep })); out[l.id] = { s: 'ok' }; sent++; }
      catch (e) { out[l.id] = { s: 'bad', m: errMsg(e) }; }
    }
    setResults(out);
    setItems((xs) => xs.filter((x) => out[x.l.id]?.s !== 'ok'));
    if (sent) toast(sent > 1 ? `${sent} requests sent to donors.` : 'Request sent to the donor.');
    if (sent < items.length) toast('Some requests could not be sent. See the tray for details.', 'bad');
    if (sent && onRequested) await onRequested();
  };

  const hot = !!(drag && drag.over && drag.ok);
  return (
    <div className="board">
      {intro}
      <div className="board-tools" role="search">
        <label className="search-f"><FiSearch aria-hidden="true" /><span className="sr">Search food</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search food, donor or note" /></label>
        <label className="sort-f"><span className="lab">Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort listings">
            <option value="soonest">Pickup soonest</option>
            <option value="most">Most available</option>
            <option value="newest">Newest</option>
            {hasDistance && <option value="nearest">Nearest</option>}
          </select></label>
        {controls}
      </div>
      <div className="fl cats" role="group" aria-label="Filter by category">
        <button className={'chip' + (cat === '' ? ' on' : '')} aria-pressed={cat === ''} onClick={() => setCat('')}>All</button>
        {CATEGORIES.map((c) => <button key={c} className={'chip' + (cat === c ? ' on' : '')} aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}
      </div>
      <div className="board-grid">
        <div className="board-main">
          <p className="board-count m" aria-live="polite">{listings ? `${shown.length} of ${listings.length} listings` : ''}</p>
          {error ? <Empty title="Couldn’t load listings">{errMsg(error)}</Empty>
            : !listings ? <Skeleton />
              : !shown.length ? <Empty title={listings.length ? 'No matches' : 'No food available right now'}>{listings.length ? 'Try another search or category.' : 'New listings appear here the moment verified donors publish them.'}</Empty>
                : (
                  <motion.div className="foods" layout={!reduce}>
                    <AnimatePresence mode="popLayout">
                      {shown.map((l, i) => (
                        <FoodCard key={l.id} l={l} i={i} layout={!reduce} inTray={inTray(l.id)} canRequest={!!ok} onAdd={add}
                          onPointerDown={start(l)} lifting={drag && drag.listing.id === l.id} />
                      ))}
                    </AnimatePresence>
                  </motion.div>
                )}
        </div>
        <Tray trayRef={trayRef} items={items} setItems={setItems} reps={reps} rep={rep} setRep={setRep} ok={!!ok} lockReason={lockReason}
          hot={hot} dragging={!!drag} onSubmit={submit} onClear={() => { setItems([]); setResults({}); }} results={results} />
      </div>
      {drag && (
        <div className={'drag-token' + (drag.over ? (drag.ok ? ' ok' : ' no') : '')} style={{ transform: `translate3d(${drag.x + 14}px, ${drag.y + 14}px, 0)` }} aria-hidden="true">
          <FiInbox /> <b>{drag.listing.title}</b> <small>{availableOf(drag.listing)} {drag.listing.unit}</small>
        </div>
      )}
    </div>
  );
}

export function LockedBoard({ title, text, action }) {
  return (
    <div className="locked-board" data-dark>
      <div className="lb-ic"><FiLock aria-hidden="true" /></div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
