import { useEffect, useMemo, useState } from 'react'
import {
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native'
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
    distanceText: string
    durationText: string
    path: RoutePoint[]
    stats: RouteStats
}

export default function MapWebScreen() {
    const [loading, setLoading] = useState(true)
    const [analyzing, setAnalyzing] = useState(false)
    const [coords, setCoords] = useState(DEFAULT_COORDS)
    const [originInput, setOriginInput] = useState('')
    const [destinationInput, setDestinationInput] = useState('')
    const [routeOptions, setRouteOptions] = useState<RouteOption[]>([])
    const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
    const [routeError, setRouteError] = useState<string | null>(null)

    const recommendedRouteId = useMemo(() => {
        if (routeOptions.length === 0) {
            return null
        }
        return [...routeOptions].sort((a, b) => a.stats.riskScore - b.stats.riskScore)[0].id
    }, [routeOptions])

    const selectedRoute = useMemo(
        () => routeOptions.find((route) => route.id === selectedRouteId) || null,
        [routeOptions, selectedRouteId]
    )

    useEffect(() => {
        void initialize()
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
            const permission = await withTimeout(Location.requestForegroundPermissionsAsync(), 2000)
            const status = permission?.status
            if (status === 'granted') {
                const current = await withTimeout(
                    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
                    2800
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
            }
        } catch (error) {
            console.warn('Location not available on web:', error)
        } finally {
            const elapsed = Date.now() - start
            const remaining = Math.max(0, 700 - elapsed)
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

            const allPoints = decodedRoutes.flatMap((route: any) => route.path)
            const bounds = getPathBounds(allPoints)
            const anomalyResponse = await getAnomaliesInViewport(
                bounds.minLat - 0.002,
                bounds.minLng - 0.002,
                bounds.maxLat + 0.002,
                bounds.maxLng + 0.002
            )

            const anomalies = (anomalyResponse.success ? anomalyResponse.data : []) as RouteAnomaly[]
            const options: RouteOption[] = decodedRoutes.map((route: any) => ({
                id: route.id,
                path: route.path,
                distanceText: route.distanceText,
                durationText: route.durationText,
                stats: calculateRouteStats(route.path, anomalies),
            }))

            setRouteOptions(options)
            const best = [...options].sort((a, b) => a.stats.riskScore - b.stats.riskScore)[0]
            setSelectedRouteId(best.id)
        } catch (error) {
            console.error('Route analysis failed:', error)
            setRouteError(error instanceof Error ? error.message : 'Route analysis failed')
            setRouteOptions([])
            setSelectedRouteId(null)
        } finally {
            setAnalyzing(false)
        }
    }

    function openInGoogleMaps() {
        const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originInput || `${coords.latitude},${coords.longitude}`)}&destination=${encodeURIComponent(destinationInput)}&travelmode=driving`
        void Linking.openURL(url)
    }

    if (loading) {
        return (
            <View style={styles.centered}>
                <BrandLoader label="Loading route planner..." />
            </View>
        )
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.hero}>
                <Text style={styles.title}>Route Quality Planner (Web)</Text>
                <Text style={styles.subtitle}>Web mode shows stats and recommendations without native map rendering.</Text>
            </View>

            <View style={styles.card}>
                <TextInput
                    value={originInput}
                    onChangeText={setOriginInput}
                    style={styles.input}
                    placeholder="Origin (address or lat,lng)"
                    placeholderTextColor={theme.colors.muted}
                />
                <TextInput
                    value={destinationInput}
                    onChangeText={setDestinationInput}
                    style={styles.input}
                    placeholder="Destination (address or lat,lng)"
                    placeholderTextColor={theme.colors.muted}
                />
                <View style={styles.row}>
                    <TouchableOpacity style={styles.primaryButton} onPress={() => void analyzeRoutes()} disabled={analyzing}>
                        <Text style={styles.primaryButtonText}>{analyzing ? 'Analyzing...' : 'Suggest Best Route'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.secondaryButton} onPress={openInGoogleMaps}>
                        <Text style={styles.secondaryButtonText}>Open in Maps</Text>
                    </TouchableOpacity>
                </View>
                {routeError && <Text style={styles.errorText}>{routeError}</Text>}
            </View>

            {routeOptions.map((route, idx) => {
                const isBest = route.id === recommendedRouteId
                const isSelected = route.id === selectedRouteId
                return (
                    <TouchableOpacity
                        key={route.id}
                        onPress={() => setSelectedRouteId(route.id)}
                        style={[styles.routeCard, isSelected && styles.routeCardSelected]}
                    >
                        <View style={styles.routeHeader}>
                            <Text style={styles.routeTitle}>Route {idx + 1}</Text>
                            {isBest && <Text style={styles.bestTag}>Recommended</Text>}
                        </View>
                        <Text style={styles.routeMeta}>{route.distanceText} | {route.durationText}</Text>
                        <Text style={styles.routeMeta}>Potholes: {route.stats.potholes}</Text>
                        <Text style={styles.routeMeta}>Active potholes: {route.stats.activePotholes}</Text>
                        <Text style={styles.routeMeta}>Filled potholes: {route.stats.filledPotholes}</Text>
                        <Text style={styles.routeMeta}>Bumps: {route.stats.speedBumps}</Text>
                        <Text style={styles.routeMeta}>Shock: {route.stats.shockScore}</Text>
                        <Text style={styles.routeMeta}>Smoothness: {route.stats.smoothPercent}%</Text>
                    </TouchableOpacity>
                )
            })}

            {selectedRoute && (
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>Selected Route Summary</Text>
                    <Text style={styles.routeMeta}>Events: {selectedRoute.stats.totalEvents}</Text>
                    <Text style={styles.routeMeta}>Risk score: {selectedRoute.stats.riskScore}</Text>
                </View>
            )}
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.bg,
    },
    content: {
        padding: 16,
        gap: 12,
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.bg,
    },
    hero: {
        backgroundColor: theme.colors.panel,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 12,
        padding: 14,
    },
    title: {
        color: theme.colors.text,
        fontSize: 20,
        fontWeight: '800',
    },
    subtitle: {
        color: theme.colors.muted,
        marginTop: 4,
        fontSize: 12,
    },
    card: {
        backgroundColor: theme.colors.panel,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 12,
        padding: 12,
        gap: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 10,
        color: theme.colors.text,
        backgroundColor: theme.colors.panelSoft,
    },
    row: {
        flexDirection: 'row',
        gap: 8,
    },
    primaryButton: {
        flex: 1,
        backgroundColor: theme.colors.accent,
        borderRadius: 10,
        paddingVertical: 10,
        alignItems: 'center',
    },
    primaryButtonText: {
        color: '#032137',
        fontWeight: '800',
        fontSize: 12,
    },
    secondaryButton: {
        flex: 1,
        backgroundColor: '#2b4a66',
        borderRadius: 10,
        paddingVertical: 10,
        alignItems: 'center',
    },
    secondaryButtonText: {
        color: theme.colors.text,
        fontWeight: '700',
        fontSize: 12,
    },
    errorText: {
        color: '#ffb5ae',
        fontSize: 12,
    },
    routeCard: {
        backgroundColor: theme.colors.panel,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 12,
        padding: 12,
    },
    routeCardSelected: {
        borderColor: theme.colors.accent,
    },
    routeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    routeTitle: {
        color: theme.colors.text,
        fontWeight: '800',
    },
    bestTag: {
        color: '#032137',
        backgroundColor: theme.colors.accent,
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 2,
        fontSize: 10,
        fontWeight: '800',
    },
    routeMeta: {
        color: theme.colors.muted,
        fontSize: 12,
        marginTop: 2,
    },
    summaryCard: {
        backgroundColor: theme.colors.panelSoft,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 12,
        padding: 12,
    },
    summaryTitle: {
        color: theme.colors.text,
        fontWeight: '800',
        marginBottom: 4,
    },
})
