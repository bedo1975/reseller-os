'use client'

import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Loader2, MapPin, Check, Navigation } from 'lucide-react'

// Fix Leaflet default icons
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Custom green icon for selected relay
const greenIcon = L.divIcon({
  html: '<div style="background:#16a34a;width:24px;height:24px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24],
})

// Default blue icon
const blueIcon = L.divIcon({
  html: '<div style="background:#007bff;width:24px;height:24px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24],
})

export interface RelayPoint {
  id: string
  name: string
  address: string
  postalCode: string
  city: string
  lat: number
  lng: number
  distance: number
  hours: string
}

interface RelayMapProps {
  postalCode: string
  city?: string
  onSelect: (relay: RelayPoint) => void
  selectedRelayId?: string | null
}

// Helper component to recenter the map when relays change
function Recenter({ relays }: { relays: RelayPoint[] }) {
  const map = useMap()
  useEffect(() => {
    if (relays.length > 0) {
      const bounds = L.latLngBounds(relays.map(r => [r.lat, r.lng]))
      map.fitBounds(bounds, { padding: [40, 40] })
    }
  }, [relays, map])
  return null
}

export function RelayMap({ postalCode, city, onSelect, selectedRelayId }: RelayMapProps) {
  const [relays, setRelays] = useState<RelayPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!postalCode || postalCode.length < 4) return
    setLoading(true)
    setError(null)
    fetch('/api/shipping/relay-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postalCode, city }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.relays) {
          setRelays(data.relays)
        } else {
          setError(data.error || 'Erreur')
        }
      })
      .catch(() => setError('Erreur réseau'))
      .finally(() => setLoading(false))
  }, [postalCode, city])

  const selectedRelay = relays.find(r => r.id === selectedRelayId)

  return (
    <div className="space-y-3">
      {/* Map */}
      <div className="relative rounded-lg overflow-hidden border border-gray-200" style={{ height: '400px' }}>
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-[#007bff]" />
            <span className="ml-2 text-sm text-gray-500">Recherche des points relais...</span>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        ) : relays.length > 0 ? (
          <MapContainer
            center={[relays[0].lat, relays[0].lng]}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
            />
            <Recenter relays={relays} />
            {relays.map(relay => (
              <Marker
                key={relay.id}
                position={[relay.lat, relay.lng]}
                icon={relay.id === selectedRelayId ? greenIcon : blueIcon}
              >
                <Popup>
                  <div style={{ minWidth: '180px' }}>
                    <p style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>{relay.name}</p>
                    <p style={{ fontSize: '12px', color: '#555', marginBottom: '4px' }}>
                      {relay.address}<br />
                      {relay.postalCode} {relay.city}
                    </p>
                    <p style={{ fontSize: '11px', color: '#777', marginBottom: '6px' }}>
                      🕐 {relay.hours}
                    </p>
                    <p style={{ fontSize: '11px', color: '#007bff', marginBottom: '8px' }}>
                      📍 {relay.distance} km
                    </p>
                    <button
                      onClick={() => onSelect(relay)}
                      style={{
                        width: '100%',
                        background: relay.id === selectedRelayId ? '#16a34a' : '#007bff',
                        color: 'white',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {relay.id === selectedRelayId ? '✓ Sélectionné' : 'Choisir ce point relais'}
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <p className="text-sm text-gray-400">Saisissez un code postal pour voir les points relais</p>
          </div>
        )}
      </div>

      {/* Selected relay details */}
      {selectedRelay && (
        <div className="rounded-lg border border-green-300 bg-green-50 p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center shrink-0">
            <Check className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm text-gray-900">{selectedRelay.name}</p>
            <p className="text-xs text-gray-600 mt-1">
              {selectedRelay.address}<br />
              {selectedRelay.postalCode} {selectedRelay.city}
            </p>
            <p className="text-xs text-gray-500 mt-1">🕐 {selectedRelay.hours}</p>
            <p className="text-xs text-green-600 mt-1">📍 À {selectedRelay.distance} km</p>
          </div>
        </div>
      )}

      {/* List of relays below map */}
      {!loading && relays.length > 0 && (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {relays.map(relay => (
            <button
              key={relay.id}
              onClick={() => onSelect(relay)}
              className={`w-full text-left p-2 rounded-md border text-xs transition-colors ${
                relay.id === selectedRelayId
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{relay.name}</span>
                <span className="text-gray-400">{relay.distance} km</span>
              </div>
              <p className="text-gray-500 mt-0.5">
                {relay.address}, {relay.postalCode} {relay.city}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
