import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    DirectionsRenderer,
    GoogleMap,
    InfoWindow,
    Marker,
    useJsApiLoader,
} from '@react-google-maps/api'
import { LocateFixed, Route as RouteIcon, X, MapPin, AlertTriangle } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { getAnomaliesInViewport } from '../lib/queries'
import { Anomaly, supabase } from '../lib/supabase'
import { calculateRouteQuality, RouteQualityStats } from '../lib/routeQuality'
import { Card, Pill, Button, IconButton, EmptyState } from '../components/ui'
import { DARK_MAP_STYLE } from '../lib/mapStyle'
import LoaderBars from '../components/LoaderBars'

const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim()

const mapContainerStyle = {
    width: '100%',
    height: '100%',
}

const mapOptions: google.maps.MapOptions = {
    disableDefaultUI: false,
    zoomControl: true,
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: true,
    clickableIcons: false,
    // Dark basemap so the map reads as part of the app, not a white cut-out.
    styles: DARK_MAP_STYLE,
}

/** Marker colors come from the design tokens, not ad-hoc hexes. */
const MARKER_COLORS = {
    POTHOLE: '#fb7185',
    SPEED_BUMP: '#fbbf24',
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

    const selectedOnCurrentRoute = useMemo(() => {
        if (!selectedAnomaly) {
            return false
        }
        return routeAnomalyIds.has(selectedAnomaly.id)
    }, [routeAnomalyIds, selectedAnomaly])

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
            <Card className="min-h-[70vh] flex items-center justify-center">
                <EmptyState
                    icon={MapPin}
                    title="Map key required"
                    description="Add VITE_GOOGLE_MAPS_API_KEY to your .env file, then restart the dev server."
                />
            </Card>
        )
    }

    if (loadError) {
        return (
            <Card className="min-h-[70vh] flex items-center justify-center">
                <EmptyState
                    icon={AlertTriangle}
                    title="Map could not load"
                    description="Check the API key, billing, the Maps JavaScript API, and the allowed referrer in Google Cloud Console. The browser console has the exact error."
                />
            </Card>
        )
    }

    return (
        <div className="rs-fade-up">
            {/* Toolbar above the map, so it never covers the canvas. */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
                <Button icon={RouteIcon} onClick={() => setRouteDialogOpen(true)}>
                    Analyze Route
                </Button>
                <p className="text-[14px] text-[var(--rs-text-muted)]">
                    Draw a route on the map to scan for road anomalies.
                </p>
            </div>

        <div className="rs-panel overflow-hidden relative h-[calc(100dvh-13rem)] min-h-[30rem]">
            {!routeDialogOpen && routeStats && (
                <div className="absolute top-4 left-4 right-4 z-10 flex flex-wrap items-center gap-2">
                    {routeStats && (
                        <div className="rs-panel-soft px-3 py-2 flex items-center gap-3 shadow-raised backdrop-blur-md">
                            <span className="rs-mono text-xs text-[var(--rs-text)]">{routeDistance || 'N/A'}</span>
                            <span className="w-px h-3 bg-[var(--rs-line-strong)]" />
                            <span className="rs-mono text-xs text-[var(--rs-text)]">{routeDuration || 'N/A'}</span>
                            <span className="w-px h-3 bg-[var(--rs-line-strong)]" />
                            <Pill tone={routeStats.smoothPercent >= 70 ? 'success' : routeStats.smoothPercent >= 40 ? 'warn' : 'danger'}>
                                {routeStats.smoothPercent}% smooth
                            </Pill>
                        </div>
                    )}
                </div>
            )}

            {routeDialogOpen && (
                <div className="absolute top-4 left-4 z-20 w-[min(30rem,calc(100%-2rem))] rs-panel shadow-raised backdrop-blur-md p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <p className="rs-kicker">Route Analytics</p>
                        <IconButton icon={X} label="Close route panel" onClick={() => setRouteDialogOpen(false)} className="h-7 w-7" />
                    </div>
                    <input
                        value={originInput}
                        onChange={(e) => setOriginInput(e.target.value)}
                        className="rs-input"
                        placeholder="Origin (address or lat, lng)"
                        aria-label="Route origin"
                    />
                    <input
                        value={destinationInput}
                        onChange={(e) => setDestinationInput(e.target.value)}
                        className="rs-input"
                        placeholder="Destination (address or lat, lng)"
                        aria-label="Route destination"
                    />
                    <div className="flex gap-2">
                        <Button
                            onClick={() => void analyzeRoute()}
                            disabled={routeLoading || !originInput || !destinationInput}
                            className="flex-1"
                        >
                            {routeLoading ? 'Analyzing...' : 'Analyze'}
                        </Button>
                        <Button variant="secondary" onClick={clearRoute}>
                            Clear
                        </Button>
                    </div>
                    {routeError && <p className="text-[13px] text-[var(--rs-danger)]">{routeError}</p>}
                </div>
            )}

            {selectedAnomaly && (
                <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:top-4 sm:bottom-auto sm:right-4 sm:w-[22rem] z-20 rs-panel shadow-raised backdrop-blur-md p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                            <p className="rs-kicker mb-1">Anomaly Details</p>
                            <div className="flex items-center gap-2">
                                <h3 className="rs-heading">
                                    {selectedAnomaly.type === 'POTHOLE' ? 'Pothole' : 'Speed Bump'}
                                </h3>
                                <Pill tone={selectedAnomaly.verified ? 'success' : 'danger'}>
                                    {selectedAnomaly.verified ? 'Repaired' : 'Active'}
                                </Pill>
                            </div>
                        </div>
                        <IconButton icon={X} label="Close details" onClick={() => setSelectedAnomaly(null)} className="h-7 w-7" />
                    </div>

                    {/* Two metrics get the large treatment; the rest are a compact list. */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="rounded-[var(--rs-r-md)] bg-[var(--rs-surface-2)] border border-[var(--rs-line)] p-3">
                            <p className="rs-kicker mb-1">Severity</p>
                            <p className="rs-metric text-[var(--rs-danger)]">{(selectedAnomaly.severity * 100).toFixed(0)}%</p>
                        </div>
                        <div className="rounded-[var(--rs-r-md)] bg-[var(--rs-surface-2)] border border-[var(--rs-line)] p-3">
                            <p className="rs-kicker mb-1">Confidence</p>
                            <p className="rs-metric text-[var(--rs-primary)]">{(selectedAnomaly.confidence * 100).toFixed(0)}%</p>
                        </div>
                    </div>

                    <dl className="space-y-2 text-[13px]">
                        <div className="flex justify-between gap-3">
                            <dt className="rs-muted">Reports</dt>
                            <dd className="rs-mono text-[var(--rs-text)]">{selectedAnomaly.verification_count}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                            <dt className="rs-muted">Speed</dt>
                            <dd className="rs-mono text-[var(--rs-text)]">
                                {selectedAnomaly.speed ? Number(selectedAnomaly.speed).toFixed(1) + ' km/h' : 'N/A'}
                            </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                            <dt className="rs-muted">Coordinates</dt>
                            <dd className="rs-mono text-[var(--rs-text)] text-xs">
                                {selectedAnomaly.latitude.toFixed(5)}, {selectedAnomaly.longitude.toFixed(5)}
                            </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                            <dt className="rs-muted">Detected</dt>
                            <dd className="text-[var(--rs-text)] text-xs text-right">
                                {new Date(selectedAnomaly.created_at).toLocaleString()}
                            </dd>
                        </div>
                        {routeStats && (
                            <div className="flex justify-between gap-3 items-center pt-1">
                                <dt className="rs-muted">Route match</dt>
                                <dd>
                                    <Pill tone={selectedOnCurrentRoute ? 'success' : 'neutral'}>
                                        {selectedOnCurrentRoute ? 'On route' : 'Off route'}
                                    </Pill>
                                </dd>
                            </div>
                        )}
                    </dl>
                </div>
            )}

            {!isLoaded ? (
                <div className="flex items-center justify-center h-full">
                    <LoaderBars label="Loading map" />
                </div>
            ) : loadingData ? (
                <div className="flex items-center justify-center h-full">
                    <LoaderBars label="Loading road data" />
                </div>
            ) : (
                <GoogleMap
                    mapContainerStyle={mapContainerStyle}
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
                                    strokeColor: '#22d3ee',
                                    strokeOpacity: 0.9,
                                    strokeWeight: 5,
                                },
                            }}
                        />
                    )}

                    {anomalies.map((anomaly) => {
                        const onRoute = routeAnomalyIds.has(anomaly.id)
                        const markerIcon = {
                            path: window.google.maps.SymbolPath.CIRCLE,
                            fillColor: MARKER_COLORS[anomaly.type as keyof typeof MARKER_COLORS] ?? MARKER_COLORS.POTHOLE,
                            fillOpacity: onRoute ? 1 : 0.78,
                            // On-route markers get a bright ring so they read first.
                            strokeColor: onRoute ? '#ffffff' : '#070a10',
                            strokeWeight: onRoute ? 2.5 : 1.5,
                            scale: onRoute ? 9 : 6.5,
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
                            <div className="rs-infowindow">
                                <div className="flex items-center gap-2 mb-2.5">
                                    <span
                                        className="rs-spine !h-[18px]"
                                        style={{ background: selectedAnomaly.type === 'POTHOLE' ? 'var(--rs-danger)' : 'var(--rs-warn)' }}
                                    />
                                    <p className="rs-heading">{selectedAnomaly.type === 'POTHOLE' ? 'Pothole' : 'Speed Bump'}</p>
                                </div>
                                <div className="rs-infowindow-row">
                                    <span className="rs-faint">Severity</span>
                                    <span className="rs-mono">{(selectedAnomaly.severity * 100).toFixed(0)}%</span>
                                </div>
                                <div className="rs-infowindow-row">
                                    <span className="rs-faint">Confidence</span>
                                    <span className="rs-mono">{(selectedAnomaly.confidence * 100).toFixed(0)}%</span>
                                </div>
                                <div className="rs-infowindow-row">
                                    <span className="rs-faint">Status</span>
                                    <Pill tone={selectedAnomaly.verified ? 'success' : 'neutral'}>
                                        {selectedAnomaly.verified ? 'Verified' : 'Active'}
                                    </Pill>
                                </div>
                                <p className="rs-micro mt-2.5">{new Date(selectedAnomaly.created_at).toLocaleString()}</p>
                            </div>
                        </InfoWindow>
                    )}
                </GoogleMap>
            )}
            {isLoaded && (
                <button
                    type="button"
                    onClick={goToCurrentLocation}
                    className="absolute bottom-6 right-4 sm:right-6 w-11 h-11 rounded-full grid place-items-center bg-[var(--rs-primary)] text-[var(--rs-primary-ink)] shadow-raised hover:brightness-110 active:scale-95 transition-all z-10"
                    aria-label="Go to current location"
                    title="Go to current location"
                >
                    <LocateFixed size={19} />
                </button>
            )}
            {locationError && (
                <div className="absolute bottom-6 left-4 sm:left-6 z-10 rs-panel-soft backdrop-blur-md px-3 py-2 text-[13px] text-[var(--rs-warn)] shadow-raised">
                    {locationError}
                </div>
            )}
        </div>
        </div>
    )
}
