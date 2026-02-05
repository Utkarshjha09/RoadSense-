import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { getAnomaliesInViewport } from '../lib/queries'
import { Anomaly } from '../lib/supabase'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

export default function MapView() {
    const [anomalies, setAnomalies] = useState<Anomaly[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadAnomalies()
    }, [])

    async function loadAnomalies() {
        try {
            // Load anomalies for Delhi, India area (example bounds)
            const data = await getAnomaliesInViewport(28.4, 77.0, 28.8, 77.4)
            setAnomalies(data)
        } catch (error) {
            console.error('Error loading anomalies:', error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="h-full bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
            {loading ? (
                <div className="flex items-center justify-center h-full">
                    <div className="text-white text-xl">Loading map...</div>
                </div>
            ) : (
                <MapContainer
                    center={[28.6139, 77.2090]}
                    zoom={11}
                    style={{ height: '100%', width: '100%' }}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {anomalies.map((anomaly) => {
                        const icon = L.divIcon({
                            className: 'custom-marker',
                            html: `<div style="background-color: ${anomaly.type === 'POTHOLE' ? '#ef4444' : '#f59e0b'
                                }; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white;"></div>`,
                        })

                        return (
                            <Marker
                                key={anomaly.id}
                                position={[anomaly.latitude, anomaly.longitude]}
                                icon={icon}
                            >
                                <Popup>
                                    <div className="p-2">
                                        <h3 className="font-bold mb-2">
                                            {anomaly.type === 'POTHOLE' ? '🕳️ Pothole' : '🚧 Speed Bump'}
                                        </h3>
                                        <p className="text-sm">
                                            <strong>Severity:</strong> {(anomaly.severity * 100).toFixed(0)}%
                                        </p>
                                        <p className="text-sm">
                                            <strong>Confidence:</strong> {(anomaly.confidence * 100).toFixed(0)}%
                                        </p>
                                        <p className="text-sm">
                                            <strong>Status:</strong>{' '}
                                            {anomaly.verified ? '✓ Verified' : '⏳ Pending'}
                                        </p>
                                        <p className="text-sm text-gray-600">
                                            {new Date(anomaly.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                </Popup>
                            </Marker>
                        )
                    })}
                </MapContainer>
            )}
        </div>
    )
}
