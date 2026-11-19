"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

const pin = L.divIcon({
  className: "",
  html: '<span style="display:block;width:26px;height:26px;border-radius:50%;background:#FFE28A;border:4px solid #102F46;box-shadow:0 4px 10px rgba(0,0,0,.35)"></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

function Clicks({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], Math.max(map.getZoom(), 15));
  }, [lat, lng, map]);
  return null;
}

/** OpenStreetMap pin picker: click/tap the map or drag the pin. */
export default function LocationPicker({
  value,
  onChange,
}: {
  value: { lat: number; lng: number } | null;
  onChange: (v: { lat: number; lng: number }) => void;
}) {
  const center = value ?? { lat: 20.5937, lng: 78.9629 };
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={value ? 15 : 4} className="h-72 w-full rounded-[18px] ring-1 ring-line" scrollWheelZoom={false}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Clicks onPick={(lat, lng) => onChange({ lat, lng })} />
      {value && (
        <>
          <Recenter lat={value.lat} lng={value.lng} />
          <Marker
            position={[value.lat, value.lng]}
            icon={pin}
            draggable
            eventHandlers={{ dragend: (e) => { const p = (e.target as L.Marker).getLatLng(); onChange({ lat: p.lat, lng: p.lng }); } }}
          />
        </>
      )}
    </MapContainer>
  );
}
