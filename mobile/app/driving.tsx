import { View, Text, StyleSheet, TouchableOpacity, Vibration, Alert, TextInput, ScrollView } from 'react-native'
import { useState, useEffect, useRef, useCallback } from 'react'
import { MaterialIcons } from '@expo/vector-icons'
import MapView, { AnimatedRegion, Marker, Polyline } from 'react-native-maps'
import * as Location from 'expo-location'
import { CombinedReading, SensorService, SensorSourceType, SensorStatus } from '../src/services/sensor.service'
import type { PredictionResult } from '../src/services/tflite.service'
import { appendLoggedSample } from '../src/services/data-logger.service'
import { getAnomaliesInViewport, uploadAnomaly } from '../src/services/supabase.service'
import { theme } from '../src/theme'
import {
    calculateRouteStats,
    decodePolyline,
    distanceBetweenPoints,
    getPathBounds,
    RouteAnomaly,
    RoutePoint,
    RouteStats,
} from '../src/utils/routeQuality'

const DEFAULT_ESP32_URL = 'ws://192.168.4.1:81'
function getMapsApiKey() {
    const key = (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '').trim()
    if (!key || /your_google_maps_api_key|placeholder/i.test(key)) {
        return ''
    }
    return key
}

const GOOGLE_MAPS_API_KEY = getMapsApiKey()

type RouteStep = {
    instruction: string
    distanceText: string
    latitude: number
    longitude: number
}

type RouteOption = {
    id: string
    path: RoutePoint[]
    distanceText: string
    durationText: string
    stats: RouteStats
    steps: RouteStep[]
}

type MapAnomalyDetail = {
    id: string
    type: 'POTHOLE' | 'SPEED_BUMP'
    severity: number
    confidence: number
    latitude: number
    longitude: number
    verified: boolean
    source: 'route' | 'live'
    timestamp: string
}

function parseDistanceToKm(value: string) {
    const normalized = value.toLowerCase().trim()
    const match = normalized.match(/([\d.]+)/)
    if (!match) return 0
    const numeric = Number(match[1])
    if (!Number.isFinite(numeric)) return 0
    if (normalized.includes('km')) return numeric
    if (normalized.includes('m')) return numeric / 1000
    return numeric
}

function parseDurationToMinutes(value: string) {
    const normalized = value.toLowerCase().trim()
    let minutes = 0
    const hourMatch = normalized.match(/(\d+)\s*h/)
    const minMatch = normalized.match(/(\d+)\s*min/)
    if (hourMatch) minutes += Number(hourMatch[1]) * 60
    if (minMatch) minutes += Number(minMatch[1])
    if (minutes > 0) return minutes
    const plainMatch = normalized.match(/([\d.]+)/)
    return plainMatch ? Number(plainMatch[1]) : 0
}

function normalizeHeading(value: number) {
    return ((value % 360) + 360) % 360
}

function headingDelta(from: number, to: number) {
    const a = normalizeHeading(from)
    const b = normalizeHeading(to)
    const diff = b - a
    if (diff > 180) return diff - 360
    if (diff < -180) return diff + 360
    return diff
}

function smoothHeading(from: number, to: number, alpha: number) {
    const clampedAlpha = Math.max(0, Math.min(1, alpha))
    return normalizeHeading(from + headingDelta(from, to) * clampedAlpha)
}

function getTurnLabel(deltaDegrees: number) {
    if (deltaDegrees <= -18) return 'left'
    if (deltaDegrees >= 18) return 'right'
    return 'straight'
}

function getRoutePreferenceScore(route: RouteOption) {
    const distanceKm = parseDistanceToKm(route.distanceText)
    const durationMin = parseDurationToMinutes(route.durationText)
    const hazardLoad = route.stats.activePotholes * 3.2
        + route.stats.speedBumps * 1.5
        + route.stats.filledPotholes * 0.6
        + route.stats.shockScore * 0.55
    const comfortPenalty = Math.max(0, 100 - route.stats.smoothPercent) * 0.12
    return Number((hazardLoad + comfortPenalty + distanceKm * 1.4 + durationMin * 0.18).toFixed(2))
}

function stripHtmlInstruction(value: string | undefined, fallback: string) {
    if (!value) return fallback
    return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || fallback
}

function getRoadConditionCopy(prediction: PredictionResult | null) {
    if (!prediction) {
        return {
            title: 'Analyzing Road Surface',
            detail: 'Waiting for live model output from the selected sensor source.',
            tone: '#8cb6d8',
        }
    }

    if (prediction.classId === 1) {
        return {
            title: 'Pothole Detected',
            detail: `Confidence ${prediction.confidence.toFixed(1)}%. Slow down and stay centered in lane.`,
            tone: '#ff9b9b',
        }
    }

    if (prediction.classId === 2) {
        return {
            title: 'Speed Bump Ahead',
            detail: `Confidence ${prediction.confidence.toFixed(1)}%. Ease off throttle for a smoother pass.`,
            tone: '#ffd98b',
        }
    }

    return {
        title: 'Road Running Smooth',
        detail: `Confidence ${prediction.confidence.toFixed(1)}%. Surface looks stable right now.`,
        tone: '#9ceccb',
    }
}

function getManeuverVisual(instruction: string | null) {
    const normalized = (instruction || '').toLowerCase()

    if (normalized.includes('u-turn')) {
        return { icon: 'u-turn-left' as const, label: 'U-turn' }
    }

    if (normalized.includes('left')) {
        return { icon: 'turn-left' as const, label: 'Turn left' }
    }

    if (normalized.includes('right')) {
        return { icon: 'turn-right' as const, label: 'Turn right' }
    }

    if (normalized.includes('merge')) {
        return { icon: 'merge-type' as const, label: 'Merge ahead' }
    }

    if (normalized.includes('continue') || normalized.includes('head')) {
        return { icon: 'north' as const, label: 'Continue ahead' }
    }

    return { icon: 'navigation' as const, label: 'Follow route' }
}

function getPredictionBadgeCopy(prediction: PredictionResult | null, isActive: boolean) {
    if (!isActive) {
        return null
    }

    if (!prediction) {
        return {
            text: 'Waiting for model output',
            detail: 'FastAPI model is warming up',
            backgroundColor: '#1d4ed8',
        }
    }

    if (prediction.classId === 1) {
        return {
            text: 'Pothole Detected',
            detail: `FastAPI confidence ${prediction.confidence.toFixed(1)}%`,
            backgroundColor: '#dc2626',
        }
    }

    if (prediction.classId === 2) {
        return {
            text: 'Speed Bump Detected',
            detail: `FastAPI confidence ${prediction.confidence.toFixed(1)}%`,
            backgroundColor: '#d97706',
        }
    }

    return {
        text: 'Road Smooth',
        detail: `FastAPI confidence ${prediction.confidence.toFixed(1)}%`,
        backgroundColor: '#10b981',
    }
}

function hasValidCoordinates(latitude: number, longitude: number) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return false
    }
    if (Math.abs(latitude) < 0.000001 && Math.abs(longitude) < 0.000001) {
        return false
    }
    return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
}

export default function DrivingScreen() {
    const [isActive, setIsActive] = useState(false)
    const [modelReady, setModelReady] = useState(false)
    const [detections, setDetections] = useState<any[]>([])
    const [currentPrediction, setCurrentPrediction] = useState<PredictionResult | null>(null)
    const [location, setLocation] = useState({ latitude: 28.6139, longitude: 77.209 })
    const [sensorData, setSensorData] = useState({ ax: 0, ay: 0, az: 0, gx: 0, gy: 0, gz: 0 })
    const [sensorSource, setSensorSource] = useState<SensorSourceType>('phone')
    const [esp32Url, setEsp32Url] = useState(DEFAULT_ESP32_URL)
    const [originInput, setOriginInput] = useState('')
    const [destinationInput, setDestinationInput] = useState('')
    const [routeOptions, setRouteOptions] = useState<RouteOption[]>([])
    const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
    const [routeAnomalies, setRouteAnomalies] = useState<RouteAnomaly[]>([])
    const [routeError, setRouteError] = useState<string | null>(null)
    const [selectedMapAnomaly, setSelectedMapAnomaly] = useState<MapAnomalyDetail | null>(null)
    const [analyzingRoute, setAnalyzingRoute] = useState(false)
    const [isNavigating, setIsNavigating] = useState(false)
    const [isNavDrawerOpen, setIsNavDrawerOpen] = useState(false)
    const [sensorStatus, setSensorStatus] = useState<SensorStatus>({
        source: 'phone',
        state: 'idle',
        message: 'Ready',
    })
    const [stats, setStats] = useState({
        smooth: 0,
        potholes: 0,
        speedBumps: 0,
        totalPredictions: 0,
    })
    const [locationHeading, setLocationHeading] = useState(0)
    const [locationIssue, setLocationIssue] = useState<string | null>(null)
    const [retryingGps, setRetryingGps] = useState(false)

    const sensorServiceRef = useRef<SensorService | null>(null)
    const mapRef = useRef<MapView>(null)
    const locationRef = useRef(location)
    const routeFocusUntilRef = useRef(0)
    const lastCameraUpdateRef = useRef(0)
    const lastCameraHeadingRef = useRef(0)
    const lastCameraLocationRef = useRef<{ latitude: number; longitude: number } | null>(null)
    const lastGpsHeadingRef = useRef<number | null>(null)
    const lastCompassHeadingRef = useRef<number | null>(null)
    const lastLocationForHeadingRef = useRef<{ latitude: number; longitude: number } | null>(null)
    const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null)
    const headingSubscriptionRef = useRef<Location.LocationSubscription | null>(null)
    const lastLocationButtonTapRef = useRef(0)
    const readingBufferRef = useRef<number[][]>([])
    const isActiveRef = useRef(false)
    const currentPredictionRef = useRef<PredictionResult | null>(null)
    const lastPredictionAtRef = useRef(0)
    const lastFallbackLogAtRef = useRef(0)
    const animatedLocationRef = useRef(
        new AnimatedRegion({
            latitude: 28.6139,
            longitude: 77.209,
            latitudeDelta: 0.0005,
            longitudeDelta: 0.0005,
        })
    )

    useEffect(() => {
        locationRef.current = location
    }, [location])

    const selectedRoute = routeOptions.find((route) => route.id === selectedRouteId) || null
    const recommendedRouteId =
        routeOptions.length > 0
            ? [...routeOptions].sort((a, b) => getRoutePreferenceScore(a) - getRoutePreferenceScore(b))[0].id
            : null
    const recommendedRoute = routeOptions.find((route) => route.id === recommendedRouteId) || null
    const routePanelsVisible = routeOptions.length > 0
    const liveAnomalies: RouteAnomaly[] = [
        ...routeAnomalies,
        ...detections.map((det, index) => ({
            id: `live-${index}`,
            type: det.type,
            severity: det.severity,
            confidence: det.confidence,
            latitude: det.latitude,
            longitude: det.longitude,
            verified: false,
        })),
    ]

    const selectedRouteAnomalies = selectedRoute
        ? liveAnomalies.filter((anomaly) => {
            for (const point of selectedRoute.path) {
                if (
                    distanceBetweenPoints(point, {
                        latitude: anomaly.latitude,
                        longitude: anomaly.longitude,
                    }) <= 45
                ) {
                    return true
                }
            }
            return false
        })
        : []
    const nextPotholeDistance = (() => {
        if (!selectedRoute || !isNavigating || selectedRoute.path.length === 0) {
            return null
        }

        const currentPoint = {
            latitude: location.latitude,
            longitude: location.longitude,
        }

        let nearestPathIndex = 0
        let nearestPathDistance = Number.POSITIVE_INFINITY
        selectedRoute.path.forEach((point, index) => {
            const distance = distanceBetweenPoints(currentPoint, point)
            if (distance < nearestPathDistance) {
                nearestPathDistance = distance
                nearestPathIndex = index
            }
        })

        const upcomingPotholes = selectedRouteAnomalies
            .filter((anomaly) => anomaly.type === 'POTHOLE')
            .map((anomaly) => {
                let nearestAnomalyIndex = 0
                let nearestAnomalyDistance = Number.POSITIVE_INFINITY

                selectedRoute.path.forEach((point, index) => {
                    const distance = distanceBetweenPoints(point, {
                        latitude: anomaly.latitude,
                        longitude: anomaly.longitude,
                    })
                    if (distance < nearestAnomalyDistance) {
                        nearestAnomalyDistance = distance
                        nearestAnomalyIndex = index
                    }
                })

                return {
                    ...anomaly,
                    pathIndex: nearestAnomalyIndex,
                    distanceMeters: distanceBetweenPoints(currentPoint, {
                        latitude: anomaly.latitude,
                        longitude: anomaly.longitude,
                    }),
                }
            })
            .filter((anomaly) => anomaly.pathIndex >= nearestPathIndex)
            .sort((a, b) => a.pathIndex - b.pathIndex || a.distanceMeters - b.distanceMeters)

        return upcomingPotholes[0] ?? null
    })()
    const navigationPath = (() => {
        if (!selectedRoute || !isNavigating || selectedRoute.path.length === 0) {
            return []
        }

        const currentPoint = {
            latitude: location.latitude,
            longitude: location.longitude,
        }

        let nearestPathIndex = 0
        let nearestPathDistance = Number.POSITIVE_INFINITY
        selectedRoute.path.forEach((point, index) => {
            const distance = distanceBetweenPoints(currentPoint, point)
            if (distance < nearestPathDistance) {
                nearestPathDistance = distance
                nearestPathIndex = index
            }
        })

        return selectedRoute.path.slice(nearestPathIndex)
    })()
    const nextStepInstruction = (() => {
        if (!selectedRoute || !isNavigating || selectedRoute.steps.length === 0) {
            return null
        }

        const currentPoint = {
            latitude: location.latitude,
            longitude: location.longitude,
        }

        const nearestPathIndex = selectedRoute.path.reduce(
            (bestIndex, point, index) =>
                distanceBetweenPoints(currentPoint, point) <
                distanceBetweenPoints(currentPoint, selectedRoute.path[bestIndex])
                    ? index
                    : bestIndex,
            0
        )

        const upcomingSteps = selectedRoute.steps
            .map((step, index) => {
                const pathIndex = selectedRoute.path.reduce(
                    (bestIndex, point, pointIndex) =>
                        distanceBetweenPoints(step, point) <
                        distanceBetweenPoints(step, selectedRoute.path[bestIndex])
                            ? pointIndex
                            : bestIndex,
                    0
                )

                return {
                    ...step,
                    order: index,
                    pathIndex,
                    distanceMeters: distanceBetweenPoints(currentPoint, step),
                }
            })
            .filter((step) => step.pathIndex >= nearestPathIndex)
            .sort((a, b) => a.pathIndex - b.pathIndex || a.order - b.order)

        return upcomingSteps[0] ?? null
    })()
    const upcomingStepPreview = (() => {
        if (!selectedRoute || !isNavigating || selectedRoute.steps.length < 2 || !nextStepInstruction) {
            return null
        }

        const currentIndex = selectedRoute.steps.findIndex((step) => step.instruction === nextStepInstruction.instruction && step.latitude === nextStepInstruction.latitude && step.longitude === nextStepInstruction.longitude)
        if (currentIndex < 0 || currentIndex + 1 >= selectedRoute.steps.length) {
            return null
        }

        return selectedRoute.steps[currentIndex + 1]
    })()
    const roadConditionCopy = getRoadConditionCopy(currentPrediction)
    const predictionBadgeCopy = getPredictionBadgeCopy(currentPrediction, isActive)
    const currentRoadDetail = (() => {
        if (!isActive) {
            return 'Detection paused. Start sensor detection to refresh road conditions.'
        }

        if (currentPrediction?.classId === 1) {
            return nextPotholeDistance
                ? `Live model sees a pothole risk, about ${Math.round(nextPotholeDistance.distanceMeters)} m ahead on this route.`
                : roadConditionCopy.detail
        }

        if (currentPrediction?.classId === 2) {
            return 'Live model sees a speed bump pattern ahead. Reduce speed for a smoother crossing.'
        }

        return roadConditionCopy.detail
    })()
    const nextManeuverText = nextStepInstruction
        ? `${nextStepInstruction.instruction}${nextStepInstruction.distanceText ? ` in ${nextStepInstruction.distanceText}` : ''}`
        : 'Stay on the highlighted route. Waiting for the next turn instruction.'
    const currentManeuver = getManeuverVisual(nextStepInstruction?.instruction ?? null)
    const routeChoiceGuidance = (() => {
        if (!selectedRoute || !recommendedRoute || routeOptions.length < 2) {
            return null
        }

        const fromPoint = {
            latitude: location.latitude,
            longitude: location.longitude,
        }

        const getHeadingForRoute = (route: RouteOption) => {
            if (route.path.length === 0) return null
            const nearestIndex = route.path.reduce((bestIndex, point, index) =>
                distanceBetweenPoints(fromPoint, point) < distanceBetweenPoints(fromPoint, route.path[bestIndex])
                    ? index
                    : bestIndex, 0)
            const lookAheadIndex = Math.min(nearestIndex + 10, route.path.length - 1)
            const targetPoint = route.path[lookAheadIndex]
            const latDelta = targetPoint.latitude - fromPoint.latitude
            const lngDelta = targetPoint.longitude - fromPoint.longitude
            if (!Number.isFinite(latDelta) || !Number.isFinite(lngDelta)) {
                return null
            }
            return normalizeHeading((Math.atan2(lngDelta, latDelta) * 180) / Math.PI)
        }

        const selectedHeading = getHeadingForRoute(selectedRoute)
        const recommendedHeading = getHeadingForRoute(recommendedRoute)
        if (selectedHeading === null || recommendedHeading === null) {
            return null
        }

        const selectedTurn = getTurnLabel(headingDelta(locationHeading, selectedHeading))
        const recommendedTurn = getTurnLabel(headingDelta(locationHeading, recommendedHeading))
        const selectedScore = getRoutePreferenceScore(selectedRoute)
        const recommendedScore = getRoutePreferenceScore(recommendedRoute)

        return {
            shouldSwitch: selectedRoute.id !== recommendedRoute.id,
            selectedTurn,
            recommendedTurn,
            selectedScore,
            recommendedScore,
            selectedRoute,
            recommendedRoute,
        }
    })()

    const computeHeadingFromPoints = (from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) => {
        const lat1 = (from.latitude * Math.PI) / 180
        const lat2 = (to.latitude * Math.PI) / 180
        const dLon = ((to.longitude - from.longitude) * Math.PI) / 180
        const y = Math.sin(dLon) * Math.cos(lat2)
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
        const bearing = (Math.atan2(y, x) * 180) / Math.PI
        return (bearing + 360) % 360
    }

    const initializeLocationTracking = useCallback(async (showAlerts: boolean) => {
        if (showAlerts) {
            setRetryingGps(true)
        }

        try {
            locationSubscriptionRef.current?.remove()
            locationSubscriptionRef.current = null
            headingSubscriptionRef.current?.remove()
            headingSubscriptionRef.current = null

            const { status } = await Location.requestForegroundPermissionsAsync()
            if (status !== 'granted') {
                setLocationIssue('Location permission denied.')
                if (showAlerts) {
                    Alert.alert('Location Permission Needed', 'Enable location permission to use live navigation and road detection.')
                }
                return
            }

            const applyLocation = (coords: { latitude: number; longitude: number }) => {
                const current = {
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                }
                setLocation(current)
                animatedLocationRef.current.setValue({
                    latitude: current.latitude,
                    longitude: current.longitude,
                    latitudeDelta: 0.0005,
                    longitudeDelta: 0.0005,
                })
                lastLocationForHeadingRef.current = current
                setOriginInput(`${current.latitude.toFixed(6)}, ${current.longitude.toFixed(6)}`)
                setLocationIssue(null)
            }

            try {
                const loc = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Highest,
                })
                applyLocation(loc.coords)
            } catch (initialLocationError) {
                const lastKnown = await Location.getLastKnownPositionAsync({
                    maxAge: 120000,
                    requiredAccuracy: 200,
                })

                if (lastKnown?.coords) {
                    applyLocation(lastKnown.coords)
                } else {
                    const message =
                        initialLocationError instanceof Error
                            ? initialLocationError.message
                            : 'Current location is unavailable'
                    setLocationIssue(message)
                    if (showAlerts) {
                        Alert.alert(
                            'Location Unavailable',
                            `${message}. Make sure GPS/location is enabled, then tap Retry GPS.`
                        )
                    }
                }
            }

            locationSubscriptionRef.current = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.Highest,
                    timeInterval: 1000,
                    distanceInterval: 1,
                },
                (position) => {
                    const nextLocation = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    }
                    setLocation(nextLocation)
                    setLocationIssue(null)
                    animatedLocationRef.current.timing({
                        latitude: nextLocation.latitude,
                        longitude: nextLocation.longitude,
                        latitudeDelta: 0.0005,
                        longitudeDelta: 0.0005,
                        duration: 900,
                        useNativeDriver: false,
                    } as any).start()

                    if (lastCompassHeadingRef.current !== null) {
                        // Compass stream is active, so avoid overriding heading with GPS course.
                    } else if (typeof position.coords.heading === 'number' && position.coords.heading >= 0) {
                        const incomingHeading = normalizeHeading(position.coords.heading)
                        setLocationHeading((prev) => smoothHeading(prev, incomingHeading, 0.25))
                        lastGpsHeadingRef.current = incomingHeading
                    } else if (lastLocationForHeadingRef.current) {
                        const movedMeters = distanceBetweenPoints(lastLocationForHeadingRef.current, nextLocation)
                        if (movedMeters >= 1.5) {
                            const inferredHeading = computeHeadingFromPoints(lastLocationForHeadingRef.current, nextLocation)
                            setLocationHeading((prev) => smoothHeading(prev, inferredHeading, 0.25))
                            lastGpsHeadingRef.current = inferredHeading
                        }
                    }

                    lastLocationForHeadingRef.current = nextLocation
                }
            )

            headingSubscriptionRef.current = await Location.watchHeadingAsync((headingData) => {
                const rawHeading =
                    typeof headingData.trueHeading === 'number' && headingData.trueHeading >= 0
                        ? headingData.trueHeading
                        : headingData.magHeading

                if (typeof rawHeading !== 'number' || rawHeading < 0) {
                    return
                }

                const incomingHeading = normalizeHeading(rawHeading)
                lastCompassHeadingRef.current = incomingHeading
                setLocationHeading((prev) => smoothHeading(prev, incomingHeading, 0.2))
            })
        } catch (error) {
            console.warn('Location init warning:', error)
            const message = error instanceof Error ? error.message : 'Unable to initialize GPS'
            setLocationIssue(message)
            if (showAlerts) {
                Alert.alert('GPS Retry Failed', `${message}. Check location settings and retry.`)
            }
        } finally {
            if (showAlerts) {
                setRetryingGps(false)
            }
        }
    }, [])

    useEffect(() => {
        void initializeLocationTracking(false)

        return () => {
            locationSubscriptionRef.current?.remove()
            locationSubscriptionRef.current = null
            headingSubscriptionRef.current?.remove()
            headingSubscriptionRef.current = null
        }
    }, [initializeLocationTracking])

    useEffect(() => {
        isActiveRef.current = isActive
    }, [isActive])

    useEffect(() => {
        const onPrediction = (prediction: PredictionResult) => {
            setCurrentPrediction(prediction)
            currentPredictionRef.current = prediction
            lastPredictionAtRef.current = Date.now()

            setStats((prev) => ({
                smooth: prev.smooth + (prediction.classId === 0 ? 1 : 0),
                potholes: prev.potholes + (prediction.classId === 1 ? 1 : 0),
                speedBumps: prev.speedBumps + (prediction.classId === 2 ? 1 : 0),
                totalPredictions: prev.totalPredictions + 1,
            }))

            const label: 'POTHOLE' | 'SPEED_BUMP' | 'NORMAL' =
                prediction.classId === 1
                    ? 'POTHOLE'
                    : prediction.classId === 2
                      ? 'SPEED_BUMP'
                      : 'NORMAL'
            const bufferedWindow = readingBufferRef.current.slice(-100)
            const drivingSample = {
                id: `drv-${Date.now()}-${Math.round(Math.random() * 100000)}`,
                timestamp: new Date().toISOString(),
                label,
                source: 'driving' as const,
                latitude: prediction.latitude,
                longitude: prediction.longitude,
                confidence: prediction.confidence,
                data: bufferedWindow,
            }

            void appendLoggedSample(drivingSample)

            // Do not force map camera on each prediction; it breaks manual control and logger flow.
            // Navigation camera updates are handled in the navigation effect.
        }

        const onAnomaly = (prediction: PredictionResult) => {
            // Keep tactile alert short and consistent: ~3 seconds.
            Vibration.vibrate([0, 500, 250, 500, 250, 500, 250, 500], false)

            const fallbackLatitude = locationRef.current.latitude
            const fallbackLongitude = locationRef.current.longitude
            const latitude = hasValidCoordinates(prediction.latitude, prediction.longitude)
                ? prediction.latitude
                : fallbackLatitude
            const longitude = hasValidCoordinates(prediction.latitude, prediction.longitude)
                ? prediction.longitude
                : fallbackLongitude

            if (!hasValidCoordinates(latitude, longitude)) {
                console.warn('Skipped anomaly upload due to invalid coordinates', {
                    predictionLatitude: prediction.latitude,
                    predictionLongitude: prediction.longitude,
                    fallbackLatitude,
                    fallbackLongitude,
                })
                return
            }

            const detection = {
                type: prediction.className === 'Pothole' ? 'POTHOLE' : 'SPEED_BUMP' as 'POTHOLE' | 'SPEED_BUMP',
                severity: prediction.confidence / 100,
                confidence: prediction.confidence / 100,
                timestamp: new Date().toISOString(),
                latitude,
                longitude,
            }

            setDetections((prev) => [detection, ...prev].slice(0, 20))

            uploadAnomaly({
                latitude,
                longitude,
                type: detection.type,
                severity: detection.severity,
                confidence: detection.confidence,
                speed: 0,
            }).then((result) => {
                if (!result.success) {
                    console.warn('Anomaly upload did not persist to Supabase anomalies:', result.error)
                }
            }).catch((err) => console.error('Upload failed:', err))
        }

        const onReading = (reading: CombinedReading) => {
            setSensorData({
                ax: reading.ax,
                ay: reading.ay,
                az: reading.az,
                gx: reading.gx,
                gy: reading.gy,
                gz: reading.gz,
            })

            const row = [reading.ax, reading.ay, reading.az, reading.gx, reading.gy, reading.gz]
            const nextBuffer = [...readingBufferRef.current, row]
            readingBufferRef.current = nextBuffer.slice(-120)

            const now = Date.now()
            const shouldWriteFallbackSample =
                isActiveRef.current &&
                now - lastPredictionAtRef.current > 8000 &&
                now - lastFallbackLogAtRef.current > 3000

            if (shouldWriteFallbackSample) {
                lastFallbackLogAtRef.current = now
                const fallbackWindow = readingBufferRef.current.slice(-20)
                const fallbackPrediction = currentPredictionRef.current
                const fallbackSample = {
                    id: `drv-fallback-${now}-${Math.round(Math.random() * 100000)}`,
                    timestamp: new Date(now).toISOString(),
                    label: 'NORMAL' as const,
                    source: 'driving' as const,
                    latitude: reading.latitude,
                    longitude: reading.longitude,
                    confidence: fallbackPrediction?.confidence,
                    data: fallbackWindow,
                }
                void appendLoggedSample(fallbackSample)
            }
        }

        const onStatus = (status: SensorStatus) => {
            setSensorStatus(status)
        }

        sensorServiceRef.current = new SensorService(onPrediction, onAnomaly, onReading, onStatus)

        return () => {
            sensorServiceRef.current?.dispose()
        }
    }, [])

    useEffect(() => {
        const initializeModel = async () => {
            if (!sensorServiceRef.current) return

            const hasPermission = await sensorServiceRef.current.requestPermissions()
            if (!hasPermission) {
                Alert.alert('Permission Required', 'Location permission is required for road detection')
                return
            }

            try {
                await sensorServiceRef.current.initialize()
                setModelReady(true)
            } catch (error) {
                console.error('Model initialization failed:', error)
                const message = error instanceof Error ? error.message : String(error)
                Alert.alert('Model Load Failed', `Failed to load AI model.\n\n${message}`)
                setModelReady(false)
            }
        }

        void initializeModel()
    }, [])

    useEffect(() => {
        if (!isNavigating || !selectedRoute || navigationPath.length === 0) {
            return
        }

        if (Date.now() < routeFocusUntilRef.current) {
            return
        }

        const now = Date.now()
        if (now - lastCameraUpdateRef.current < 550) {
            return
        }

        const previous = lastCameraLocationRef.current
        if (previous) {
            const movedMeters = distanceBetweenPoints(previous, {
                latitude: location.latitude,
                longitude: location.longitude,
            })
            if (movedMeters < 1.8) {
                return
            }
        }

        const nextPoint = navigationPath[Math.min(6, navigationPath.length - 1)]
        const routeHeading = computeHeadingFromPoints(
            { latitude: location.latitude, longitude: location.longitude },
            nextPoint
        )
        const compassHeading = lastCompassHeadingRef.current
        const gpsHeading = lastGpsHeadingRef.current
        const hasCompassHeading = typeof compassHeading === 'number' && compassHeading >= 0
        const hasGpsHeading = typeof gpsHeading === 'number' && gpsHeading >= 0
        const targetHeading = hasCompassHeading ? compassHeading : hasGpsHeading ? gpsHeading : routeHeading
        const smoothedHeading = Number.isFinite(targetHeading)
            ? smoothHeading(lastCameraHeadingRef.current, normalizeHeading(targetHeading), 0.3)
            : lastCameraHeadingRef.current

        mapRef.current?.animateCamera(
            {
                center: {
                    latitude: location.latitude,
                    longitude: location.longitude,
                },
                zoom: 17,
                pitch: 50,
                heading: Number.isFinite(smoothedHeading) ? smoothedHeading : 0,
                altitude: 800,
            },
            { duration: 700 }
        )
        lastCameraHeadingRef.current = smoothedHeading
        lastCameraUpdateRef.current = now
        lastCameraLocationRef.current = {
            latitude: location.latitude,
            longitude: location.longitude,
        }
    }, [isNavigating, location.latitude, location.longitude, navigationPath, selectedRoute])

    const handleAnalyzeRoutes = async () => {
        if (!GOOGLE_MAPS_API_KEY) {
            setRouteError('Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in mobile .env')
            return
        }

        if (!originInput.trim() || !destinationInput.trim()) {
            setRouteError('Enter both origin and destination.')
            return
        }

        try {
            setAnalyzingRoute(true)
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
                steps: (route.legs?.[0]?.steps || []).map((step: any, stepIndex: number) => ({
                    instruction: stripHtmlInstruction(step.html_instructions, `Continue on route ${stepIndex + 1}`),
                    distanceText: step.distance?.text || '',
                    latitude: step.start_location?.lat ?? route.legs?.[0]?.start_location?.lat ?? location.latitude,
                    longitude: step.start_location?.lng ?? route.legs?.[0]?.start_location?.lng ?? location.longitude,
                })),
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
            setIsNavigating(false)

            mapRef.current?.fitToCoordinates(best.path, {
                edgePadding: { top: 150, right: 80, bottom: 300, left: 80 },
                animated: true,
            })
        } catch (error) {
            console.error('Driving route analysis failed:', error)
            setRouteError(error instanceof Error ? error.message : 'Route analysis failed')
            setRouteOptions([])
            setSelectedRouteId(null)
            setRouteAnomalies([])
            setIsNavigating(false)
        } finally {
            setAnalyzingRoute(false)
        }
    }

    const handleStart = async () => {
        if (!sensorServiceRef.current) return false
        if (!modelReady) {
            Alert.alert('Model Not Ready', 'AI model is not loaded yet. Please wait or reopen the app after update.')
            return false
        }

        if (sensorSource === 'esp32' && !esp32Url.trim()) {
            Alert.alert('ESP32 URL Required', 'Enter the ESP32 WebSocket URL before starting.')
            return false
        }

        try {
            await sensorServiceRef.current.startCollection({
                type: sensorSource,
                websocketUrl: sensorSource === 'esp32' ? esp32Url.trim() : undefined,
            })
            setIsActive(true)
            setStats({ smooth: 0, potholes: 0, speedBumps: 0, totalPredictions: 0 })
            setDetections([])
            setCurrentPrediction(null)
            return true
        } catch (error) {
            console.error('Failed to start collection:', error)
            const message = error instanceof Error ? error.message : 'Failed to start sensor collection'
            Alert.alert('Error', message)
            return false
        }
    }

    const handleToggleNavigation = async () => {
        if (isNavigating) {
            setIsNavigating(false)
            setIsNavDrawerOpen(false)
            routeFocusUntilRef.current = 0
            return
        }

        if (!selectedRoute) {
            Alert.alert('Select Route First', 'Select the best route first, then start navigation.')
            return
        }

        if (!isActive) {
            const started = await handleStart()
            if (!started) {
                return
            }
        }

        routeFocusUntilRef.current = Date.now() + 2400
        mapRef.current?.fitToCoordinates(selectedRoute.path, {
            edgePadding: { top: 180, right: 80, bottom: 320, left: 80 },
            animated: true,
        })
        setIsNavDrawerOpen(false)
        setIsNavigating(true)
    }

    const handleStop = async () => {
        await sensorServiceRef.current?.stopCollection()
        setIsActive(false)
    }

    const handleLocationButtonPress = () => {
        if (retryingGps) {
            return
        }

        const now = Date.now()
        const isDoubleTap = now - lastLocationButtonTapRef.current < 320
        lastLocationButtonTapRef.current = now

        if (isDoubleTap) {
            lastLocationButtonTapRef.current = 0
            void initializeLocationTracking(true)
            return
        }

        mapRef.current?.animateToRegion(
            {
                latitude: location.latitude,
                longitude: location.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
            },
            400
        )
    }

    return (
        <View style={styles.container}>
            <View style={styles.mapContainer}>
                <MapView
                    ref={mapRef}
                    style={styles.map}
                    initialRegion={{
                        latitude: location.latitude,
                        longitude: location.longitude,
                        latitudeDelta: 0.005,
                        longitudeDelta: 0.005,
                }}
                showsUserLocation={!isNavigating}
                showsMyLocationButton={false}
                followsUserLocation={isNavigating}
            >
                    {isNavigating && (
                        <Marker.Animated
                            coordinate={animatedLocationRef.current as any}
                            title="Your Location"
                            anchor={{ x: 0.5, y: 0.5 }}
                            flat
                            rotation={locationHeading}
                        >
                            <View style={styles.liveHeadingMarker}>
                                <MaterialIcons
                                    name="navigation"
                                    size={32}
                                    color="#2a7cff"
                                />
                            </View>
                        </Marker.Animated>
                    )}

                    {navigationPath.length > 1 && (
                        <Polyline
                            coordinates={navigationPath}
                            strokeWidth={8}
                            strokeColor="#8df2ff"
                            zIndex={6}
                        />
                    )}

                    {routeOptions.map((route) => (
                        <Polyline
                            key={route.id}
                            coordinates={route.path}
                            strokeWidth={route.id === selectedRouteId ? (isNavigating ? 3 : 6) : 4}
                            strokeColor={route.id === selectedRouteId ? '#49d3ff' : '#6d7f99'}
                        />
                    ))}

                    {routeAnomalies.map((anomaly) => (
                        <Marker
                            key={anomaly.id}
                            coordinate={{ latitude: anomaly.latitude, longitude: anomaly.longitude }}
                            title={anomaly.type === 'POTHOLE' ? 'Pothole' : 'Speed Bump'}
                            description={`Severity ${(anomaly.severity * 100).toFixed(0)}% | Confidence ${(anomaly.confidence * 100).toFixed(0)}%`}
                            onPress={() =>
                                setSelectedMapAnomaly({
                                    id: anomaly.id,
                                    type: anomaly.type,
                                    severity: anomaly.severity,
                                    confidence: anomaly.confidence,
                                    latitude: anomaly.latitude,
                                    longitude: anomaly.longitude,
                                    verified: anomaly.verified,
                                    source: 'route',
                                    timestamp: new Date().toISOString(),
                                })
                            }
                        >
                            <View style={[styles.anomalyFlag, anomaly.type === 'POTHOLE' ? styles.potholeFlag : styles.bumpFlag]}>
                                <MaterialIcons
                                    name={anomaly.type === 'POTHOLE' ? 'warning' : 'speed'}
                                    size={11}
                                    color="#ffffff"
                                />
                                <Text style={styles.anomalyFlagText}>
                                    {anomaly.type === 'POTHOLE' ? 'POTHOLE' : 'BUMP'}
                                </Text>
                            </View>
                        </Marker>
                    ))}

                    {detections.map((det, idx) => (
                        <Marker
                            key={`det-${idx}`}
                            coordinate={{ latitude: det.latitude, longitude: det.longitude }}
                            title={det.type === 'POTHOLE' ? 'Pothole' : 'Speed Bump'}
                            description={`Severity ${(det.severity * 100).toFixed(0)}% | Confidence ${(det.confidence * 100).toFixed(0)}%`}
                            onPress={() =>
                                setSelectedMapAnomaly({
                                    id: `live-${idx}`,
                                    type: det.type,
                                    severity: det.severity,
                                    confidence: det.confidence,
                                    latitude: det.latitude,
                                    longitude: det.longitude,
                                    verified: false,
                                    source: 'live',
                                    timestamp: det.timestamp,
                                })
                            }
                        >
                            <View style={[styles.anomalyFlag, det.type === 'POTHOLE' ? styles.potholeFlag : styles.bumpFlag]}>
                                <MaterialIcons
                                    name={det.type === 'POTHOLE' ? 'warning' : 'speed'}
                                    size={11}
                                    color="#ffffff"
                                />
                                <Text style={styles.anomalyFlagText}>
                                    {det.type === 'POTHOLE' ? 'LIVE POTHOLE' : 'LIVE BUMP'}
                                </Text>
                            </View>
                        </Marker>
                    ))}
                </MapView>

                {selectedMapAnomaly && (
                    <View style={styles.anomalyDetailsCard}>
                        <View style={styles.anomalyDetailsHeader}>
                            <Text style={styles.anomalyDetailsTitle}>
                                {selectedMapAnomaly.type === 'POTHOLE' ? 'Pothole' : 'Speed Bump'} details
                            </Text>
                            <TouchableOpacity onPress={() => setSelectedMapAnomaly(null)}>
                                <Text style={styles.anomalyDetailsClose}>Close</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.anomalyDetailsLine}>
                            Source: {selectedMapAnomaly.source === 'live' ? 'Live detection' : 'Route anomaly'}
                        </Text>
                        <Text style={styles.anomalyDetailsLine}>
                            Severity: {(selectedMapAnomaly.severity * 100).toFixed(0)}% | Confidence: {(selectedMapAnomaly.confidence * 100).toFixed(0)}%
                        </Text>
                        <Text style={styles.anomalyDetailsLine}>
                            Status: {selectedMapAnomaly.verified ? 'Verified/Repaired' : 'Active'}
                        </Text>
                        <Text style={styles.anomalyDetailsLine}>
                            Lat/Lng: {selectedMapAnomaly.latitude.toFixed(6)}, {selectedMapAnomaly.longitude.toFixed(6)}
                        </Text>
                        <Text style={styles.anomalyDetailsTime}>
                            {new Date(selectedMapAnomaly.timestamp).toLocaleString()}
                        </Text>
                    </View>
                )}

                <View style={styles.overlay}>
                    {isNavigating ? (
                        <>
                            <View style={styles.navHudCard}>
                                <View style={styles.navBannerPrimary}>
                                    <View style={styles.navBannerLead}>
                                        <View style={styles.navManeuverIconWrap}>
                                            <MaterialIcons name={currentManeuver.icon} size={28} color="#ffffff" />
                                        </View>
                                        <View style={styles.navBannerCopy}>
                                            <Text style={styles.navHudKicker}>Live Navigation</Text>
                                            <Text style={styles.navBannerTitle}>{currentManeuver.label}</Text>
                                            <Text style={styles.navBannerSubtitle}>{nextManeuverText}</Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        style={[styles.navButton, styles.navButtonActive]}
                                        onPress={() => void handleToggleNavigation()}
                                    >
                                        <Text style={styles.navButtonText}>Stop Navigation</Text>
                                    </TouchableOpacity>
                                </View>
                                <TouchableOpacity style={styles.drawerToggle} onPress={() => setIsNavDrawerOpen((prev) => !prev)}>
                                    <Text style={styles.drawerToggleText}>{isNavDrawerOpen ? 'Hide details' : 'Show details'}</Text>
                                    <MaterialIcons name={isNavDrawerOpen ? 'expand-less' : 'expand-more'} size={20} color={theme.colors.text} />
                                </TouchableOpacity>
                                {isNavDrawerOpen && (
                                    <>
                                        <View style={styles.navBannerSecondary}>
                                            <Text style={styles.navBannerSecondaryText}>
                                                {upcomingStepPreview
                                                    ? `Then ${upcomingStepPreview.instruction}`
                                                    : selectedRoute
                                                      ? `${selectedRoute.distanceText} | ${selectedRoute.durationText}`
                                                      : 'Following selected route'}
                                            </Text>
                                        </View>
                                        <View style={styles.navDetailBlock}>
                                            <Text style={styles.navDetailLabel}>Route choice guidance</Text>
                                            <Text style={styles.navDetailTitle}>
                                                {routeChoiceGuidance
                                                    ? routeChoiceGuidance.shouldSwitch
                                                        ? `Take ${routeChoiceGuidance.recommendedTurn.toUpperCase()} to switch to Route ${routeOptions.findIndex((route) => route.id === routeChoiceGuidance.recommendedRoute.id) + 1}`
                                                        : `Stay ${routeChoiceGuidance.selectedTurn.toUpperCase()} on Route ${routeOptions.findIndex((route) => route.id === selectedRoute?.id) + 1}`
                                                    : 'Evaluating best turn from distance, potholes, bumps, and road comfort'}
                                            </Text>
                                            <Text style={styles.navDetailText}>
                                                {routeChoiceGuidance
                                                    ? `Best score ${routeChoiceGuidance.recommendedScore.toFixed(2)} (distance + hazards + bumps + smoothness). Current selection score ${routeChoiceGuidance.selectedScore.toFixed(2)}.`
                                                    : 'Guidance updates live when multiple route options are available.'}
                                            </Text>
                                        </View>
                                        <View style={styles.navDetailBlock}>
                                            <Text style={styles.navDetailLabel}>Road condition now</Text>
                                            <Text style={[styles.navDetailTitle, { color: roadConditionCopy.tone }]}>
                                                {roadConditionCopy.title}
                                            </Text>
                                            <Text style={styles.navDetailText}>{currentRoadDetail}</Text>
                                        </View>
                                        <View style={styles.navDetailBlock}>
                                            <Text style={styles.navDetailLabel}>Hazard guidance</Text>
                                            <Text style={styles.navDetailTitle}>
                                                {nextPotholeDistance
                                                    ? `Next pothole is about ${Math.round(nextPotholeDistance.distanceMeters)} m ahead`
                                                    : 'No pothole currently detected ahead on the selected route'}
                                            </Text>
                                            <Text style={styles.navDetailText}>
                                                Guidance is based on the selected route plus the live model stream from your sensor source.
                                            </Text>
                                        </View>
                                    </>
                                )}
                                <Text style={styles.navHudMeta}>
                                    Detection: {isActive ? 'Live' : 'Inactive'} | Source: {sensorSource === 'phone' ? 'Phone' : 'ESP32'}
                                </Text>
                            </View>

                        </>
                    ) : (
                        <>
                            <View style={styles.routePlannerCard}>
                                <Text style={styles.routePlannerTitle}>Driving Navigation</Text>
                                <TextInput
                                    value={originInput}
                                    onChangeText={setOriginInput}
                                    style={styles.input}
                                    placeholder="Origin (address or lat,lng)"
                                    placeholderTextColor="#7f96ab"
                                />
                                <TextInput
                                    value={destinationInput}
                                    onChangeText={setDestinationInput}
                                    style={styles.input}
                                    placeholder="Destination (address or lat,lng)"
                                    placeholderTextColor="#7f96ab"
                                />
                                <TouchableOpacity
                                    style={[styles.routeButton, analyzingRoute && styles.controlButtonDisabled]}
                                    onPress={() => void handleAnalyzeRoutes()}
                                    disabled={analyzingRoute}
                                >
                                    <Text style={styles.routeButtonText}>{analyzingRoute ? 'Analyzing...' : 'Suggest Best Route'}</Text>
                                </TouchableOpacity>
                                {routeError ? <Text style={styles.routeErrorText}>{routeError}</Text> : null}
                            </View>

                            <View style={styles.infoCard}>
                                <Text style={styles.infoLabel}>Location</Text>
                                <Text style={styles.infoText}>{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</Text>
                            </View>

                            <View style={styles.infoCard}>
                                <Text style={styles.infoLabel}>Gyroscope (x/y/z)</Text>
                                <Text style={styles.infoText}>{sensorData.gx.toFixed(2)} / {sensorData.gy.toFixed(2)} / {sensorData.gz.toFixed(2)}</Text>
                            </View>

                            <View style={styles.infoCard}>
                                <Text style={styles.infoLabel}>Accelerometer (x/y/z)</Text>
                                <Text style={styles.infoText}>{sensorData.ax.toFixed(2)} / {sensorData.ay.toFixed(2)} / {sensorData.az.toFixed(2)}</Text>
                            </View>

                        </>
                    )}
                </View>

                {predictionBadgeCopy && (
                    <View
                        pointerEvents="none"
                        style={[
                            styles.floatingPredictionChip,
                            {
                                bottom: isNavigating ? 84 : routePanelsVisible ? 404 : 176,
                                backgroundColor: predictionBadgeCopy.backgroundColor,
                            },
                        ]}
                    >
                        <Text style={styles.floatingPredictionText}>{predictionBadgeCopy.text}</Text>
                        <Text style={styles.floatingPredictionDetail}>{predictionBadgeCopy.detail}</Text>
                    </View>
                )}

                <TouchableOpacity
                    style={[styles.locationButton, { bottom: isNavigating ? 28 : routePanelsVisible ? 438 : 190 }]}
                    onPress={handleLocationButtonPress}
                >
                    <MaterialIcons name="my-location" size={24} color={theme.colors.text} />
                </TouchableOpacity>

                {routeOptions.length > 0 && !isNavigating && (
                    <View style={styles.bottomStack}>
                        <View style={styles.routeStripPanel}>
                            <ScrollView style={styles.bottomPanel} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.routeCards}>
                                {routeOptions.map((route, index) => {
                                    const isBest = route.id === recommendedRouteId
                                    const isSelected = route.id === selectedRouteId

                                    return (
                                        <TouchableOpacity
                                            key={route.id}
                                            onPress={() => {
                                                setSelectedRouteId(route.id)
                                                setIsNavigating(false)
                                                mapRef.current?.fitToCoordinates(route.path, {
                                                    edgePadding: { top: 150, right: 80, bottom: 290, left: 80 },
                                                    animated: true,
                                                })
                                            }}
                                            style={[styles.routeCard, isSelected && styles.routeCardSelected]}
                                        >
                                            <View style={styles.routeCardHeader}>
                                                <Text style={styles.routeName}>Route {index + 1}</Text>
                                                {isBest && <Text style={styles.bestTag}>Recommended</Text>}
                                            </View>
                                            <Text style={styles.routeMeta}>{route.distanceText} | {route.durationText}</Text>
                                            <Text style={styles.routeMeta}>Potholes: {route.stats.potholes}</Text>
                                            <Text style={styles.routeMeta}>Bumps: {route.stats.speedBumps}</Text>
                                            <Text style={styles.routeMeta}>Smooth: {route.stats.smoothPercent}%</Text>
                                            <Text style={styles.routeMeta}>Shock: {route.stats.shockScore}</Text>
                                        </TouchableOpacity>
                                    )
                                })}
                            </ScrollView>
                        </View>

                        {selectedRoute && (
                            <View style={styles.summaryPanel}>
                                <View style={styles.summaryHeader}>
                                    <Text style={styles.summaryTitle}>Driving Route Guidance</Text>
                                    <TouchableOpacity
                                        style={[
                                            styles.navButton,
                                            !selectedRoute && styles.navButtonDisabled,
                                            isNavigating && styles.navButtonActive,
                                        ]}
                                        onPress={() => void handleToggleNavigation()}
                                        disabled={!selectedRoute}
                                    >
                                        <Text style={styles.navButtonText}>{isNavigating ? 'Stop Navigation' : 'Start Navigation'}</Text>
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.summaryText}>Selected route: {selectedRoute.distanceText} | {selectedRoute.durationText}</Text>
                                <Text style={styles.summaryText}>
                                    Route score: {getRoutePreferenceScore(selectedRoute).toFixed(2)}
                                    {recommendedRoute ? ` | Best score: ${getRoutePreferenceScore(recommendedRoute).toFixed(2)}` : ''}
                                </Text>
                                <Text style={styles.summaryText}>Active potholes: {selectedRoute.stats.activePotholes}</Text>
                                <Text style={styles.summaryText}>Filled potholes: {selectedRoute.stats.filledPotholes}</Text>
                                <Text style={styles.summaryText}>Speed bumps: {selectedRoute.stats.speedBumps}</Text>
                                <Text style={styles.summaryText}>Smoothness: {selectedRoute.stats.smoothPercent}%</Text>
                                {routeChoiceGuidance && (
                                    <Text style={styles.summaryText}>
                                        Suggested turn now: {routeChoiceGuidance.shouldSwitch ? routeChoiceGuidance.recommendedTurn.toUpperCase() : routeChoiceGuidance.selectedTurn.toUpperCase()}
                                    </Text>
                                )}
                                {isNavigating ? (
                                    <Text style={styles.navigationHint}>
                                        {nextPotholeDistance
                                            ? `Live guidance: next pothole is about ${Math.round(nextPotholeDistance.distanceMeters)} m ahead on this route`
                                            : 'Live guidance: no pothole currently detected ahead on the selected route'}
                                    </Text>
                                ) : (
                                    <Text style={styles.navigationIdleText}>
                                        Select the best route, then tap Start Navigation to get live pothole distance updates while driving.
                                    </Text>
                                )}
                            </View>
                        )}
                    </View>
                )}
            </View>

            {!isNavigating && (
                <>
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{stats.totalPredictions}</Text>
                            <Text style={styles.statLabel}>Total</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{stats.potholes}</Text>
                            <Text style={styles.statLabel}>Potholes</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{stats.speedBumps}</Text>
                            <Text style={styles.statLabel}>Bumps</Text>
                        </View>
                    </View>

                    <View style={styles.bottomControlPanel}>
                        <Text style={styles.infoLabel}>Sensor Source</Text>
                        <View style={styles.bottomToggleRow}>
                            <TouchableOpacity
                                style={[styles.sourceChip, sensorSource === 'phone' && styles.sourceChipActive]}
                                disabled={isActive}
                                onPress={() => setSensorSource('phone')}
                            >
                                <Text style={[styles.sourceChipText, sensorSource === 'phone' && styles.sourceChipTextActive]}>Phone</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.sourceChip, sensorSource === 'esp32' && styles.sourceChipActive]}
                                disabled={isActive}
                                onPress={() => setSensorSource('esp32')}
                            >
                                <Text style={[styles.sourceChipText, sensorSource === 'esp32' && styles.sourceChipTextActive]}>ESP32</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.statusText}>{sensorStatus.message}</Text>

                        {sensorSource === 'esp32' && (
                            <>
                                <Text style={[styles.infoLabel, styles.bottomInputLabel]}>ESP32 WebSocket</Text>
                                <TextInput
                                    value={esp32Url}
                                    editable={!isActive}
                                    onChangeText={setEsp32Url}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    placeholder="ws://192.168.4.1:81"
                                    placeholderTextColor="#7f96ab"
                                    style={styles.input}
                                />
                                <Text style={styles.helperText}>ESP32 should send JSON like {`{"ax":0.1,"ay":0.0,"az":9.8,"gx":0.01,"gy":0.02,"gz":0.03}`}</Text>
                            </>
                        )}

                        <TouchableOpacity
                            style={[
                                styles.controlButtonInline,
                                isActive && styles.controlButtonActive,
                                !isActive && !modelReady && styles.controlButtonDisabled,
                            ]}
                            onPress={() => void (isActive ? Promise.resolve(handleStop()) : handleStart())}
                        >
                            <Text style={styles.controlButtonText}>
                                {isActive ? 'Stop Detection' : modelReady ? `Start ${sensorSource === 'phone' ? 'Phone' : 'ESP32'} Detection` : 'Loading Model...'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
    mapContainer: { flex: 1, position: 'relative' },
    map: { width: '100%', height: '100%' },
    overlay: { position: 'absolute', top: 50, left: 0, right: 0, paddingHorizontal: 14, gap: 8 },
    routePlannerCard: { backgroundColor: 'rgba(12, 30, 50, 0.92)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, gap: 8 },
    routePlannerTitle: { fontSize: 14, color: theme.colors.text, fontWeight: '800' },
    infoCard: { backgroundColor: 'rgba(12, 30, 50, 0.92)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border },
    infoLabel: { fontSize: 11, color: theme.colors.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '700' },
    infoText: { fontSize: 14, color: theme.colors.text, fontWeight: '700' },
    toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    sourceChip: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: 'rgba(6, 17, 30, 0.65)', alignItems: 'center' },
    sourceChipActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
    sourceChipText: { color: theme.colors.text, fontWeight: '700' },
    sourceChipTextActive: { color: '#032137' },
    statusText: { fontSize: 12, color: theme.colors.muted, fontWeight: '600' },
    input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: theme.colors.text, backgroundColor: 'rgba(6, 17, 30, 0.8)', fontSize: 14 },
    routeButton: { backgroundColor: theme.colors.accent, borderRadius: 10, alignItems: 'center', paddingVertical: 11 },
    routeButtonText: { color: '#032137', fontWeight: '800' },
    routeErrorText: { color: '#ffaaa1', fontSize: 12 },
    helperText: { color: theme.colors.muted, fontSize: 11, marginTop: 8, lineHeight: 16 },
    floatingPredictionChip: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignSelf: 'center',
        width: 220,
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.28)',
        zIndex: 25,
    },
    floatingPredictionText: { fontSize: 15, fontWeight: '800', color: '#ffffff', letterSpacing: 0.2 },
    floatingPredictionDetail: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.92)', marginTop: 3 },
    anomalyDetailsCard: {
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 88,
        backgroundColor: 'rgba(7, 24, 40, 0.95)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: 10,
        zIndex: 22,
    },
    anomalyDetailsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    anomalyDetailsTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '800' },
    anomalyDetailsClose: { color: theme.colors.accent, fontSize: 12, fontWeight: '700' },
    anomalyDetailsLine: { color: theme.colors.muted, fontSize: 12, marginTop: 2 },
    anomalyDetailsTime: { color: '#9ec3e0', fontSize: 11, marginTop: 6, fontWeight: '600' },
    liveHeadingMarker: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(255,255,255,0.9)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(42,124,255,0.35)',
    },
    anomalyFlag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderRadius: 8,
        paddingHorizontal: 7,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.35)',
    },
    potholeFlag: {
        backgroundColor: 'rgba(215, 38, 61, 0.95)',
    },
    bumpFlag: {
        backgroundColor: 'rgba(227, 155, 21, 0.95)',
    },
    anomalyFlagText: {
        color: '#ffffff',
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    locationButton: { position: 'absolute', right: 16, width: 56, height: 56, borderRadius: 18, backgroundColor: 'rgba(12, 30, 50, 0.94)', borderWidth: 1, borderColor: theme.colors.border, justifyContent: 'center', alignItems: 'center', zIndex: 20 },
    navHudCard: { backgroundColor: 'rgba(12, 30, 50, 0.9)', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, gap: 8 },
    navHudKicker: { color: theme.colors.accent, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
    navHudTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '800', marginTop: 4 },
    navHudMeta: { color: theme.colors.muted, fontSize: 12, fontWeight: '600' },
    navBannerPrimary: { backgroundColor: '#0e8058', borderRadius: 14, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
    navBannerLead: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    navManeuverIconWrap: { width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
    navBannerCopy: { flex: 1 },
    navBannerTitle: { color: '#ffffff', fontSize: 18, fontWeight: '800' },
    navBannerSubtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600', marginTop: 2 },
    navBannerSecondary: { backgroundColor: '#11623f', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
    navBannerSecondaryText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
    drawerToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(8, 20, 34, 0.7)',
        borderWidth: 1,
        borderColor: 'rgba(120, 180, 220, 0.14)',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 7,
    },
    drawerToggleText: { color: theme.colors.text, fontSize: 13, fontWeight: '700' },
    navDetailBlock: { backgroundColor: 'rgba(4, 14, 26, 0.48)', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: 'rgba(120, 180, 220, 0.14)' },
    navDetailLabel: { color: '#7abfe8', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 4 },
    navDetailTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '800' },
    navDetailText: { color: theme.colors.muted, fontSize: 12, lineHeight: 17, marginTop: 4 },
    bottomStack: { position: 'absolute', bottom: 12, left: 12, right: 12, gap: 10 },
    routeStripPanel: { backgroundColor: '#0b2035ee', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingVertical: 8 },
    bottomPanel: { maxHeight: 154 },
    routeCards: { paddingHorizontal: 0, gap: 10 },
    routeCard: { width: 220, backgroundColor: '#0b2035ee', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 12 },
    routeCardSelected: { borderColor: theme.colors.accent },
    routeCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    routeName: { color: theme.colors.text, fontWeight: '800', fontSize: 14 },
    bestTag: { color: '#032137', backgroundColor: theme.colors.accent, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, fontSize: 10, fontWeight: '800' },
    routeMeta: { color: theme.colors.muted, fontSize: 12, marginTop: 2 },
    summaryPanel: { backgroundColor: '#102943eb', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 10 },
    summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 6 },
    summaryTitle: { color: theme.colors.text, fontSize: 13, fontWeight: '800' },
    summaryText: { color: theme.colors.muted, fontSize: 12 },
    navButton: { backgroundColor: theme.colors.accent, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
    navButtonActive: { backgroundColor: theme.colors.danger },
    navButtonDisabled: { backgroundColor: '#425873' },
    navButtonText: { color: '#032137', fontSize: 11, fontWeight: '800' },
    navigationHint: { color: '#9ceccb', fontSize: 12, fontWeight: '700', marginTop: 8 },
    navigationIdleText: { color: '#8cb6d8', fontSize: 12, fontWeight: '600', marginTop: 8, lineHeight: 18 },
    statsRow: { flexDirection: 'row', backgroundColor: theme.colors.panel, padding: 16, gap: 16, borderTopWidth: 1, borderTopColor: theme.colors.border },
    bottomControlPanel: {
        backgroundColor: theme.colors.panel,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 16,
    },
    bottomToggleRow: { flexDirection: 'row', gap: 8, marginBottom: 8, marginTop: 2 },
    bottomInputLabel: { marginTop: 10 },
    statItem: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 22, fontWeight: '800', color: theme.colors.text },
    statLabel: { fontSize: 12, color: theme.colors.muted, marginTop: 4 },
    controlButton: { backgroundColor: theme.colors.accent, marginHorizontal: 16, marginTop: 14, marginBottom: 16, padding: 20, borderRadius: 14, alignItems: 'center' },
    controlButtonInline: { backgroundColor: theme.colors.accent, marginTop: 12, padding: 18, borderRadius: 14, alignItems: 'center' },
    controlButtonActive: { backgroundColor: theme.colors.danger },
    controlButtonDisabled: { backgroundColor: '#425873' },
    controlButtonText: { color: '#032137', fontSize: 17, fontWeight: '800', letterSpacing: 0.4 },
})
