import { useEffect, useMemo, useRef, useState } from 'react'
import {
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LocateFixed, Search, ChevronLeft } from 'lucide-react-native'
import { router } from 'expo-router'
import MapView, { Marker, Polyline } from 'react-native-maps'
import * as Location from 'expo-location'
import { getAnomaliesInViewport } from '../src/services/supabase.service'
import { theme } from '../src/theme'
import {
    calculateRouteStats,
    decodePolyline,
    getPathBounds,
    RouteAnomaly,
    RoutePoint,
    RouteStats,
} from '../src/utils/routeQuality'
import { BrandLoader } from '../components/brand-loader'
import { BottomNavBar } from '../components/bottom-nav-bar'
import { Pill } from '../components/ui-kit'

const DEFAULT_COORDS = { latitude: 28.6139, longitude: 77.209 }
function getMapsApiKey() {
    const key = (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '').trim()
    if (!key || /your_google_maps_api_key|placeholder/i.test(key)) {
        return ''
    }
    return key
}

const GOOGLE_MAPS_API_KEY = getMapsApiKey()

type RouteOption = {
    id: string
    path: RoutePoint[]
    distanceText: string
    durationText: string
    stats: RouteStats
}

export default function MapScreen() {
    const insets = useSafeAreaInsets()
    const [loading, setLoading] = useState(true)
    const [analyzing, setAnalyzing] = useState(false)
    const [coords, setCoords] = useState(DEFAULT_COORDS)
    const [originInput, setOriginInput] = useState('')
    const [destinationInput, setDestinationInput] = useState('')
    const [routeOptions, setRouteOptions] = useState<RouteOption[]>([])
    const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
    const [routeError, setRouteError] = useState<string | null>(null)
    const [routeAnomalies, setRouteAnomalies] = useState<RouteAnomaly[]>([])

    const mapRef = useRef<MapView>(null)
    const locationWatchRef = useRef<Location.LocationSubscription | null>(null)

    const selectedRoute = useMemo(
        () => routeOptions.find((route) => route.id === selectedRouteId) || null,
        [routeOptions, selectedRouteId]
    )

    const recommendedRouteId = useMemo(() => {
        if (routeOptions.length === 0) {
            return null
        }
        return [...routeOptions].sort((a, b) => a.stats.riskScore - b.stats.riskScore)[0].id
    }, [routeOptions])

    useEffect(() => {
        void initialize()
        return () => {
            locationWatchRef.current?.remove()
            locationWatchRef.current = null
        }
    }, [])

    function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
        return Promise.race<T | null>([
            promise,
            new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
        ])
    }

    async function initialize() {
        const start = Date.now()
        try {
            const permission = await withTimeout(Location.requestForegroundPermissionsAsync(), 2500)
            const status = permission?.status
            if (status === 'granted') {
                const current = await withTimeout(
                    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
                    3000
                )
                if (current) {
                    const currentCoords = {
                        latitude: current.coords.latitude,
                        longitude: current.coords.longitude,
                    }
                    setCoords(currentCoords)
                    setOriginInput(`${currentCoords.latitude.toFixed(6)}, ${currentCoords.longitude.toFixed(6)}`)
                } else {
                    setOriginInput(`${DEFAULT_COORDS.latitude.toFixed(6)}, ${DEFAULT_COORDS.longitude.toFixed(6)}`)
                }

                locationWatchRef.current = await Location.watchPositionAsync(
                    {
                        accuracy: Location.Accuracy.Balanced,
                        timeInterval: 4000,
                        distanceInterval: 10,
                    },
                    (position) => {
                        setCoords({
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                        })
                    }
                )
            }
        } catch (error) {
            console.warn('Could not get current location for route planner:', error)
        } finally {
            const elapsed = Date.now() - start
            const remaining = Math.max(0, 900 - elapsed)
            setTimeout(() => setLoading(false), remaining)
        }
    }

    async function analyzeRoutes() {
        if (!GOOGLE_MAPS_API_KEY) {
            setRouteError('Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in mobile .env')
            return
        }

        if (!originInput.trim() || !destinationInput.trim()) {
            setRouteError('Enter both origin and destination.')
            return
        }

        try {
            setAnalyzing(true)
            setRouteError(null)

            const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(originInput.trim())}&destination=${encodeURIComponent(destinationInput.trim())}&mode=driving&alternatives=true&key=${GOOGLE_MAPS_API_KEY}`
            const response = await fetch(url)
            const payload = await response.json()

            if (!response.ok || payload.status !== 'OK') {
                throw new Error(payload.error_message || payload.status || 'Directions API failed')
            }

            const decodedRoutes = payload.routes.map((route: any, index: number) => ({
                id: `route-${index + 1}`,
                path: decodePolyline(route.overview_polyline.points),
                distanceText: route.legs?.[0]?.distance?.text || '-',
                durationText: route.legs?.[0]?.duration?.text || '-',
            }))

            const allPoints = decodedRoutes.flatMap((route: RouteOption) => route.path)
            const bounds = getPathBounds(allPoints)
            const anomalyResponse = await getAnomaliesInViewport(
                bounds.minLat - 0.002,
                bounds.minLng - 0.002,
                bounds.maxLat + 0.002,
                bounds.maxLng + 0.002
            )

            const anomalies = (anomalyResponse.success ? anomalyResponse.data : []) as RouteAnomaly[]
            setRouteAnomalies(anomalies)

            const options: RouteOption[] = decodedRoutes.map((route: RouteOption) => ({
                ...route,
                stats: calculateRouteStats(route.path, anomalies),
            }))

            setRouteOptions(options)
            const best = [...options].sort((a, b) => a.stats.riskScore - b.stats.riskScore)[0]
            setSelectedRouteId(best.id)

            mapRef.current?.fitToCoordinates(best.path, {
                edgePadding: { top: 110, right: 80, bottom: 240, left: 80 },
                animated: true,
            })
        } catch (error) {
            console.error('Route analysis failed:', error)
            setRouteError(error instanceof Error ? error.message : 'Route analysis failed')
            setRouteOptions([])
            setSelectedRouteId(null)
            setRouteAnomalies([])
        } finally {
            setAnalyzing(false)
        }
    }

    function centerOnUser() {
        mapRef.current?.animateToRegion(
            {
                latitude: coords.latitude,
                longitude: coords.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
            },
            400
        )
    }

    if (loading) {
        return (
            <View style={styles.centered}>
                <BrandLoader label="Loading route planner..." />
            </View>
        )
    }

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={{
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                    latitudeDelta: 0.045,
                    longitudeDelta: 0.045,
                }}
                showsUserLocation
                showsMyLocationButton={false}
                followsUserLocation={false}
            >
                <Marker coordinate={coords} title="Current location" />

                {routeAnomalies.map((anomaly) => (
                    <Marker
                        key={anomaly.id}
                        coordinate={{ latitude: anomaly.latitude, longitude: anomaly.longitude }}
                        pinColor={anomaly.type === 'POTHOLE' ? theme.colors.danger : theme.colors.accentWarm}
                        title={anomaly.type === 'POTHOLE' ? 'Pothole' : 'Speed bump'}
                        description={anomaly.verified ? 'Reported as filled/verified' : 'Active anomaly'}
                    />
                ))}

                {routeOptions.map((route) => (
                    <Polyline
                        key={route.id}
                        coordinates={route.path}
                        strokeWidth={route.id === selectedRouteId ? 6 : 4}
                        strokeColor={route.id === selectedRouteId ? theme.colors.accent : 'rgba(237,242,255,0.28)'}
                    />
                ))}
            </MapView>

            <View style={[styles.topPanel, { top: insets.top + 10 }]}>
                <View style={styles.topPanelHeaderRow}>
                    <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/home')}>
                        <ChevronLeft size={18} color={theme.colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.panelTitle}>Route Quality Planner</Text>
                </View>
                <View style={styles.inputRow}>
                    <Search size={14} color={theme.colors.muted2} />
                    <TextInput
                        value={originInput}
                        onChangeText={setOriginInput}
                        style={styles.input}
                        placeholder="Origin (address or lat,lng)"
                        placeholderTextColor={theme.colors.muted}
                    />
                </View>
                <View style={styles.inputRow}>
                    <Search size={14} color={theme.colors.muted2} />
                    <TextInput
                        value={destinationInput}
                        onChangeText={setDestinationInput}
                        style={styles.input}
                        placeholder="Destination (address or lat,lng)"
                        placeholderTextColor={theme.colors.muted}
                    />
                </View>
                <TouchableOpacity style={styles.primaryButton} onPress={() => void analyzeRoutes()} disabled={analyzing}>
                    <Text style={styles.primaryButtonText}>{analyzing ? 'Analyzing...' : 'Suggest Best Route'}</Text>
                </TouchableOpacity>
                {routeError && <Text style={styles.errorText}>{routeError}</Text>}
            </View>

            <TouchableOpacity
                style={[styles.locationButton, { bottom: (routeOptions.length > 0 ? 302 : 96) + insets.bottom }]}
                onPress={centerOnUser}
                activeOpacity={0.9}
            >
                <LocateFixed size={20} color={theme.colors.text} />
            </TouchableOpacity>

            {routeOptions.length > 0 && (
                <View style={[styles.bottomStack, { bottom: 96 + insets.bottom }]}>
                    {selectedRoute && (
                        <View style={styles.summaryPanel}>
                            <Text style={styles.summaryTitle}>Selected Route Stats</Text>
                            <Text style={styles.summaryText}>Active potholes: {selectedRoute.stats.activePotholes}</Text>
                            <Text style={styles.summaryText}>Filled potholes: {selectedRoute.stats.filledPotholes}</Text>
                            <Text style={styles.summaryText}>Speed bumps: {selectedRoute.stats.speedBumps}</Text>
                            <Text style={styles.summaryText}>Smoothness: {selectedRoute.stats.smoothPercent}%</Text>
                        </View>
                    )}

                    <ScrollView style={styles.bottomPanel} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.routeCards}>
                        {routeOptions.map((route, index) => {
                            const isBest = route.id === recommendedRouteId
                            const isSelected = route.id === selectedRouteId

                            return (
                                <TouchableOpacity
                                    key={route.id}
                                    onPress={() => {
                                        setSelectedRouteId(route.id)
                                        mapRef.current?.fitToCoordinates(route.path, {
                                            edgePadding: { top: 110, right: 80, bottom: 260, left: 80 },
                                            animated: true,
                                        })
                                    }}
                                    style={[styles.routeCard, isSelected && styles.routeCardSelected]}
                                >
                                    <View style={styles.routeCardHeader}>
                                        <Text style={styles.routeName}>Route {index + 1}</Text>
                                        {isBest && <Pill tone="cyan" size="xs">Recommended</Pill>}
                                    </View>
                                    <Text style={styles.routeMeta}>{route.distanceText} &middot; {route.durationText}</Text>
                                    <View style={styles.qualityBarTrack}>
                                        <View style={[styles.qualityBarFill, { width: `${route.stats.smoothPercent}%` }]} />
                                    </View>
                                    <View style={styles.routeStatsRow}>
                                        <Text style={styles.routeMeta}><Text style={styles.dangerDot}>&bull;</Text> {route.stats.potholes} potholes</Text>
                                        <Text style={styles.routeMeta}><Text style={styles.warmDot}>&bull;</Text> {route.stats.speedBumps} bumps</Text>
                                    </View>
                                    <Text style={styles.routeMeta}>Smooth {route.stats.smoothPercent}% &middot; Shock {route.stats.shockScore}</Text>
                                    <Text style={styles.routeMeta}>Filled potholes: {route.stats.filledPotholes}</Text>
                                </TouchableOpacity>
                            )
                        })}
                    </ScrollView>
                </View>
            )}

            <BottomNavBar active="map" />
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.bg,
    },
    map: {
        flex: 1,
    },
    topPanel: {
        position: 'absolute',
        left: 12,
        right: 12,
        backgroundColor: 'rgba(13,16,24,0.92)',
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: 14,
        gap: 8,
    },
    topPanelHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 2,
    },
    backButton: {
        width: 30,
        height: 30,
        borderRadius: 10,
        backgroundColor: theme.colors.panel,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    panelTitle: {
        color: theme.colors.text,
        fontFamily: theme.fonts.bodyBold,
        fontSize: 14,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: theme.colors.panel,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.md,
        paddingHorizontal: 12,
    },
    input: {
        flex: 1,
        paddingVertical: 10,
        color: theme.colors.text,
        fontFamily: theme.fonts.body,
        fontSize: 13,
    },
    primaryButton: {
        backgroundColor: theme.colors.accent,
        borderRadius: theme.radius.md,
        alignItems: 'center',
        paddingVertical: 12,
        marginTop: 2,
    },
    primaryButtonText: {
        color: theme.colors.bg,
        fontFamily: theme.fonts.bodyBold,
        fontSize: 13,
    },
    errorText: {
        color: theme.colors.danger,
        fontFamily: theme.fonts.body,
        fontSize: 12,
    },
    locationButton: {
        position: 'absolute',
        right: 16,
        width: 48,
        height: 48,
        borderRadius: theme.radius.lg,
        backgroundColor: 'rgba(13,16,24,0.92)',
        borderWidth: 1,
        borderColor: theme.colors.border,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 20,
    },
    bottomStack: {
        position: 'absolute',
        left: 12,
        right: 12,
        gap: 10,
    },
    bottomPanel: {
        maxHeight: 190,
    },
    routeCards: {
        paddingHorizontal: 2,
        gap: 10,
    },
    routeCard: {
        width: 200,
        backgroundColor: 'rgba(13,16,24,0.94)',
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.lg,
        padding: 12,
        gap: 5,
    },
    routeCardSelected: {
        borderColor: theme.colors.accent,
    },
    routeCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 2,
    },
    routeName: {
        color: theme.colors.text,
        fontFamily: theme.fonts.bodyBold,
        fontSize: 13,
    },
    routeMeta: {
        color: theme.colors.muted,
        fontFamily: theme.fonts.body,
        fontSize: 11,
    },
    routeStatsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    dangerDot: {
        color: theme.colors.danger,
    },
    warmDot: {
        color: theme.colors.accentWarm,
    },
    qualityBarTrack: {
        height: 4,
        borderRadius: 2,
        backgroundColor: theme.colors.border,
    },
    qualityBarFill: {
        height: 4,
        borderRadius: 2,
        backgroundColor: theme.colors.success,
    },
    summaryPanel: {
        backgroundColor: 'rgba(13,16,24,0.94)',
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.lg,
        padding: 12,
    },
    summaryTitle: {
        color: theme.colors.text,
        fontFamily: theme.fonts.bodyBold,
        fontSize: 12,
        marginBottom: 6,
    },
    summaryText: {
        color: theme.colors.muted,
        fontFamily: theme.fonts.body,
        fontSize: 12,
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.bg,
    },
})
