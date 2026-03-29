import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    DirectionsRenderer,
    GoogleMap,
    InfoWindow,
    Marker,
    useJsApiLoader,
} from '@react-google-maps/api'
import { LocateFixed } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { getAnomaliesInViewport } from '../lib/queries'
import { Anomaly, supabase } from '../lib/supabase'
import { calculateRouteQuality, RouteQualityStats } from '../lib/routeQuality'

const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim()

const mapContainerStyle = {
    width: '100%',
    height: '100%',
}

const defaultCenter = {
    lat: 28.6139,
    lng: 77.209,
}

const mapOptions = {
    disableDefaultUI: false,
    zoomControl: true,
    streetViewControl: false,
    mapTypeControl: true,
    fullscreenControl: true,
}

export default function MapView() {
    const [searchParams] = useSearchParams()
    const [anomalies, setAnomalies] = useState<Anomaly[]>([])
    const [loadingData, setLoadingData] = useState(true)
    const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null)
    const [placedMarker, setPlacedMarker] = useState<{ lat: number, lng: number } | null>(null)
    const [currentLocation, setCurrentLocation] = useState<{ lat: number, lng: number } | null>(null)
    const [locationError, setLocationError] = useState<string | null>(null)
    const [mapRef, setMapRef] = useState<google.maps.Map | null>(null)

    const [originInput, setOriginInput] = useState('')
    const [destinationInput, setDestinationInput] = useState('')
    const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null)
    const [routeStats, setRouteStats] = useState<RouteQualityStats | null>(null)
    const [routeDistance, setRouteDistance] = useState<string>('')
    const [routeDuration, setRouteDuration] = useState<string>('')
    const [routeError, setRouteError] = useState<string | null>(null)
    const [routeLoading, setRouteLoading] = useState(false)
    const [routeDialogOpen, setRouteDialogOpen] = useState(false)
    const didSetInitialOriginRef = useRef(false)

    const focusLocation = useMemo(() => {
        const lat = Number(searchParams.get('lat'))
        const lng = Number(searchParams.get('lng'))
        const zoom = Number(searchParams.get('zoom') || '16')

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return null
        }

        return {
            lat,
            lng,
            zoom: Number.isFinite(zoom) ? zoom : 16,
        }
    }, [searchParams])

    const isKeyConfigured = GOOGLE_MAPS_API_KEY.length > 0

    const { isLoaded, loadError } = useJsApiLoader({
        id: 'roadsense-google-map',
        googleMapsApiKey: isKeyConfigured ? GOOGLE_MAPS_API_KEY : '',
    })

    const routeAnomalyIds = useMemo(() => {
        if (!routeStats) {
            return new Set<string>()
        }
        return new Set(routeStats.matchedAnomalies.map((item) => item.id))
    }, [routeStats])

    const loadAnomalies = useCallback(async () => {
        try {
            const data = await getAnomaliesInViewport(-90, -180, 90, 180)
            setAnomalies(data)
        } catch (error) {
            console.error('Error loading anomalies:', error)
        } finally {
            setLoadingData(false)
        }
    }, [])

    const onMapLoad = useCallback((map: google.maps.Map) => {
        setMapRef(map)

        if (focusLocation) {
            map.setCenter({ lat: focusLocation.lat, lng: focusLocation.lng })
            map.setZoom(focusLocation.zoom)
            return
        }

        if (anomalies.length === 0 && !currentLocation) {
            return
        }

        const bounds = new window.google.maps.LatLngBounds()
        if (currentLocation) {
            bounds.extend(currentLocation)
        }
        anomalies.forEach((anomaly) => {
            bounds.extend({ lat: anomaly.latitude, lng: anomaly.longitude })
        })
        map.fitBounds(bounds)
    }, [anomalies, currentLocation, focusLocation])

    useEffect(() => {
        if (!mapRef || !focusLocation) {
            return
        }

        mapRef.panTo({ lat: focusLocation.lat, lng: focusLocation.lng })
        mapRef.setZoom(focusLocation.zoom)
    }, [focusLocation, mapRef])

    useEffect(() => {
        void loadAnomalies()
    }, [loadAnomalies])

    useEffect(() => {
        if (!navigator.geolocation) {
            setLocationError('Geolocation is not supported in this browser.')
            return
        }

        const onLocationSuccess = (position: GeolocationPosition) => {
            const location = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
            }
            setCurrentLocation(location)
            setLocationError(null)

            if (!didSetInitialOriginRef.current) {
                setOriginInput(`${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`)
                didSetInitialOriginRef.current = true
            }
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                onLocationSuccess(position)
            },
            (error) => {
                if (error.code === error.PERMISSION_DENIED) {
                    setLocationError('Location access denied. Enable browser location permission.')
                    return
                }
                setLocationError('Could not fetch your location. Check GPS/network and try again.')
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
        )

        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                onLocationSuccess(position)
            },
            (error) => {
                if (error.code === error.PERMISSION_DENIED) {
                    setLocationError('Live location denied by browser permission settings.')
                    return
                }
                setLocationError('Live location updates are unavailable.')
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 4000 }
        )

        return () => {
            navigator.geolocation.clearWatch(watchId)
        }
    }, [])

    useEffect(() => {
        const channel = supabase
            .channel('anomalies-realtime-map')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'anomalies' },
                () => {
                    void loadAnomalies()
                }
            )
            .subscribe()

        return () => {
            void supabase.removeChannel(channel)
        }
    }, [loadAnomalies])

    useEffect(() => {
        if (!directions || anomalies.length === 0) {
            return
        }

        const route = directions.routes[0]
        const path = route.overview_path.map((point) => ({ lat: point.lat(), lng: point.lng() }))
        setRouteStats(calculateRouteQuality(path, anomalies))
    }, [directions, anomalies])

    const analyzeRoute = useCallback(async () => {
        if (!isLoaded || !originInput.trim() || !destinationInput.trim()) {
            return
        }

        try {
            setRouteLoading(true)
            setRouteError(null)

            const service = new window.google.maps.DirectionsService()
            const result = await service.route({
                origin: originInput.trim(),
                destination: destinationInput.trim(),
                travelMode: window.google.maps.TravelMode.DRIVING,
                provideRouteAlternatives: false,
            })

            setDirections(result)
            const firstLeg = result.routes[0]?.legs?.[0]
            setRouteDistance(firstLeg?.distance?.text || '')
            setRouteDuration(firstLeg?.duration?.text || '')

            const path = result.routes[0].overview_path.map((point) => ({ lat: point.lat(), lng: point.lng() }))
            setRouteStats(calculateRouteQuality(path, anomalies))
        } catch (error) {
            console.error('Route analysis failed:', error)
            setRouteError('Unable to analyze route. Check locations and try again.')
            setDirections(null)
            setRouteStats(null)
            setRouteDistance('')
            setRouteDuration('')
        } finally {
            setRouteLoading(false)
        }
    }, [anomalies, destinationInput, isLoaded, originInput])

    const clearRoute = useCallback(() => {
        setDirections(null)
        setRouteStats(null)
        setRouteDistance('')
        setRouteDuration('')
        setRouteError(null)
    }, [])

    const handleMapClick = useCallback((event: google.maps.MapMouseEvent) => {
        if (!event.latLng) {
            return
        }

        setPlacedMarker({
            lat: event.latLng.lat(),
            lng: event.latLng.lng(),
        })
    }, [])

    const goToCurrentLocation = useCallback(() => {
        if (!navigator.geolocation || !mapRef) {
            return
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                }
                setCurrentLocation(location)
                setOriginInput(`${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`)
                setLocationError(null)
                mapRef.panTo(location)
                mapRef.setZoom(15)
            },
            () => {
                setLocationError('Unable to fetch your current location.')
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
        )
    }, [mapRef])

    if (!isKeyConfigured) {
        return (
            <div className="h-full rs-panel flex items-center justify-center">
                <div className="text-center p-8">
                    <h3 className="text-xl font-bold text-[var(--rs-text)] mb-2">Google Maps API Key Required</h3>
                    <p className="text-[var(--rs-muted)] mb-4">Please add VITE_GOOGLE_MAPS_API_KEY to your .env file</p>
                    <p className="text-sm text-[var(--rs-muted)]">Restart the Vite server after updating .env</p>
                </div>
            </div>
        )
    }

    if (loadError) {
        return (
            <div className="h-full rs-panel flex items-center justify-center">
                <div className="text-center p-8">
                    <h3 className="text-xl font-bold text-red-400 mb-2">Map Could Not Load</h3>
                    <p className="text-[var(--rs-text)] mb-3">
                        Google Maps failed to load. Check API key, billing, Maps JavaScript API, and allowed referrer in Google Cloud Console.
                    </p>
                    <p className="text-sm text-[var(--rs-muted)]">Open browser console for exact Google Maps error details.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="h-full rs-panel overflow-hidden relative">
            <div className="absolute top-20 left-4 z-10 flex gap-2">
                <button
                    type="button"
                    onClick={() => setRouteDialogOpen(true)}
                    className="rs-button-primary px-4 py-2.5"
                >
                    Analyze Route
                </button>
                {routeStats && (
                    <div className="rs-panel-soft px-3 py-2 text-sm text-[var(--rs-text)]">
                        {routeDistance || '-'} | {routeDuration || '-'} | Smoothness {routeStats.smoothPercent}%
                    </div>
                )}
            </div>

            {routeDialogOpen && (
                <div className="absolute top-20 left-4 z-20 w-[560px] max-w-[calc(100%-2rem)] bg-[#2b5c7bcf] border border-cyan-300/25 rounded-2xl p-4 space-y-3 backdrop-blur-sm">
                    <p className="text-xs uppercase tracking-[0.14em] text-cyan-100/85">Route Analytics</p>
                    <input
                        value={originInput}
                        onChange={(e) => setOriginInput(e.target.value)}
                        className="rs-input"
                        placeholder="Origin (address or lat,lng)"
                    />
                    <input
                        value={destinationInput}
                        onChange={(e) => setDestinationInput(e.target.value)}
                        className="rs-input"
                        placeholder="Destination (address or lat,lng)"
                    />
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => void analyzeRoute()}
                            disabled={routeLoading || !originInput || !destinationInput}
                            className="rs-button-primary px-6 py-2.5 disabled:opacity-60"
                        >
                            {routeLoading ? 'Analyzing...' : 'Analyze Route'}
                        </button>
                        <button
                            type="button"
                            onClick={clearRoute}
                            className="rs-button-secondary px-6 py-2.5"
                        >
                            Clear
                        </button>
                        <button
                            type="button"
                            onClick={() => setRouteDialogOpen(false)}
                            className="rs-button-secondary px-6 py-2.5"
                        >
                            Close
                        </button>
                    </div>
                    {routeError && <p className="text-sm text-rose-300">{routeError}</p>}
                </div>
            )}

            {!isLoaded ? (
                <div className="flex items-center justify-center h-full">
                    <div className="text-white text-xl">Loading Google Maps...</div>
                </div>
            ) : loadingData ? (
                <div className="flex items-center justify-center h-full">
                    <div className="text-white text-xl">Loading pothole coordinates...</div>
                </div>
            ) : (
                <GoogleMap
                    mapContainerStyle={mapContainerStyle}
                    defaultCenter={defaultCenter}
                    defaultZoom={12}
                    options={mapOptions}
                    onLoad={onMapLoad}
                    onClick={handleMapClick}
                >
                    {directions && (
                        <DirectionsRenderer
                            directions={directions}
                            options={{
                                suppressMarkers: true,
                                polylineOptions: {
                                    strokeColor: '#44d0ff',
                                    strokeOpacity: 0.88,
                                    strokeWeight: 6,
                                },
                            }}
                        />
                    )}

                    {anomalies.map((anomaly) => {
                        const onRoute = routeAnomalyIds.has(anomaly.id)
                        const markerIcon = {
                            path: window.google.maps.SymbolPath.CIRCLE,
                            fillColor: anomaly.type === 'POTHOLE' ? '#ef4444' : '#f59e0b',
                            fillOpacity: onRoute ? 1 : 0.85,
                            strokeColor: '#ffffff',
                            strokeWeight: onRoute ? 2.5 : 2,
                            scale: onRoute ? 9 : 7,
                        }

                        return (
                            <Marker
                                key={anomaly.id}
                                position={{ lat: anomaly.latitude, lng: anomaly.longitude }}
                                icon={markerIcon}
                                onClick={() => setSelectedAnomaly(anomaly)}
                            />
                        )
                    })}

                    {currentLocation && (
                        <Marker position={currentLocation} title="Your current location" />
                    )}

                    {placedMarker && (
                        <Marker
                            position={placedMarker}
                            title="Placed marker"
                            onClick={() => setPlacedMarker(null)}
                        />
                    )}

                    {selectedAnomaly && (
                        <InfoWindow
                            position={{
                                lat: selectedAnomaly.latitude,
                                lng: selectedAnomaly.longitude,
                            }}
                            onCloseClick={() => setSelectedAnomaly(null)}
                        >
                            <div className="p-2">
                                <h3 className="font-bold mb-2">{selectedAnomaly.type === 'POTHOLE' ? 'Pothole' : 'Speed Bump'}</h3>
                                <p className="text-sm">
                                    <strong>Severity:</strong> {(selectedAnomaly.severity * 100).toFixed(0)}%
                                </p>
                                <p className="text-sm">
                                    <strong>Confidence:</strong> {(selectedAnomaly.confidence * 100).toFixed(0)}%
                                </p>
                                <p className="text-sm">
                                    <strong>Status:</strong> {selectedAnomaly.verified ? 'Filled/Verified' : 'Active'}
                                </p>
                                <p className="text-sm text-gray-600">{new Date(selectedAnomaly.created_at).toLocaleString()}</p>
                            </div>
                        </InfoWindow>
                    )}
                </GoogleMap>
            )}
            {isLoaded && (
                <button
                    type="button"
                    onClick={goToCurrentLocation}
                    className="absolute bottom-6 right-24 bg-cyan-500 hover:bg-cyan-400 text-[#071325] w-12 h-12 rounded-full border border-cyan-300 shadow-lg flex items-center justify-center transition-colors"
                    aria-label="Go to current location"
                    title="Go to current location"
                >
                    <LocateFixed size={20} />
                </button>
            )}
            {locationError && (
                <div className="absolute bottom-6 left-6 bg-[#071325e8] text-[var(--rs-text)] text-sm px-3 py-2 rounded border border-[var(--rs-border-soft)]">
                    {locationError}
                </div>
            )}
        </div>
    )
}
