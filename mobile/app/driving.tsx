import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Vibration } from 'react-native'
import { useState, useEffect } from 'react'
import { useRoadSensors } from '../src/hooks/useRoadSensors'
import * as Location from 'expo-location'
import { uploadAnomaly } from '../src/services/supabase.service'

export default function DrivingScreen() {
    const { isActive, currentWindow, sensorStats, start, stop } = useRoadSensors()
    const [location, setLocation] = useState<Location.LocationObject | null>(null)
    const [speed, setSpeed] = useState(0)
    const [detections, setDetections] = useState<any[]>([])
    const [isPaused, setIsPaused] = useState(false)

    // Request location permissions
    useEffect(() => {
        ; (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync()
            if (status !== 'granted') {
                alert('Permission to access location was denied')
                return
            }

            // Watch location
            Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.BestForNavigation,
                    timeInterval: 1000,
                    distanceInterval: 1,
                },
                (loc) => {
                    setLocation(loc)
                    // Convert m/s to km/h
                    const speedKmh = (loc.coords.speed || 0) * 3.6
                    setSpeed(speedKmh)

                    // Pause if speed < 10 km/h
                    if (speedKmh < 10 && isActive) {
                        setIsPaused(true)
                    } else if (speedKmh >= 10 && isPaused) {
                        setIsPaused(false)
                    }
                }
            )
        })()
    }, [])

    // Process sensor windows (mock inference for now)
    useEffect(() => {
        if (!currentWindow || isPaused) return

        // TODO: Replace with actual TFLite inference
        // For now, use random detection for testing
        const mockInference = () => {
            const random = Math.random()
            if (random > 0.95) {
                // 5% chance of detection
                const type = random > 0.975 ? 'SPEED_BUMP' : 'POTHOLE'
                const severity = 0.8 + Math.random() * 0.2
                const confidence = 0.85 + Math.random() * 0.15

                // Vibrate phone
                Vibration.vibrate([0, 200, 100, 200])

                // Add to detections list
                const detection = {
                    type,
                    severity,
                    confidence,
                    timestamp: new Date().toISOString(),
                    latitude: location?.coords.latitude,
                    longitude: location?.coords.longitude,
                }

                setDetections((prev) => [detection, ...prev].slice(0, 10))

                // Upload to backend
                if (location) {
                    uploadAnomaly({
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                        type,
                        severity,
                        confidence,
                        speed: location.coords.speed || undefined,
                    })
                }

                return type
            }
            return null
        }

        const detected = mockInference()
        console.log('Window processed:', detected || 'No anomaly')
    }, [currentWindow, isPaused, location])

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>🚗 Driving Mode</Text>
                <View style={styles.speedBadge}>
                    <Text style={styles.speedText}>{speed.toFixed(0)} km/h</Text>
                </View>
            </View>

            {/* Status */}
            <View style={styles.statusCard}>
                <View style={[styles.statusIndicator, isActive && !isPaused && styles.statusActive]} />
                <Text style={styles.statusText}>
                    {!isActive ? 'Stopped' : isPaused ? 'Paused (Speed < 10 km/h)' : 'Detecting...'}
                </Text>
            </View>

            {/* Stats */}
            <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                    <Text style={styles.statValue}>{sensorStats.windowCount}</Text>
                    <Text style={styles.statLabel}>Windows</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statValue}>{sensorStats.frequency} Hz</Text>
                    <Text style={styles.statLabel}>Frequency</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statValue}>{detections.length}</Text>
                    <Text style={styles.statLabel}>Detections</Text>
                </View>
            </View>

            {/* Detections List */}
            <ScrollView style={styles.detectionsList}>
                <Text style={styles.detectionsTitle}>Recent Detections</Text>
                {detections.length === 0 ? (
                    <Text style={styles.emptyText}>No anomalies detected yet</Text>
                ) : (
                    detections.map((det, idx) => (
                        <View key={idx} style={styles.detectionCard}>
                            <Text style={styles.detectionType}>{det.type === 'POTHOLE' ? '🕳️ Pothole' : '🚧 Speed Bump'}</Text>
                            <Text style={styles.detectionInfo}>
                                Severity: {(det.severity * 100).toFixed(0)}% | Confidence: {(det.confidence * 100).toFixed(0)}%
                            </Text>
                            <Text style={styles.detectionTime}>{new Date(det.timestamp).toLocaleTimeString()}</Text>
                        </View>
                    ))
                )}
            </ScrollView>

            {/* Control Button */}
            <TouchableOpacity
                style={[styles.controlButton, isActive && styles.controlButtonActive]}
                onPress={() => (isActive ? stop() : start())}
            >
                <Text style={styles.controlButtonText}>{isActive ? 'Stop Detection' : 'Start Detection'}</Text>
            </TouchableOpacity>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: 60,
        backgroundColor: '#1e293b',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    speedBadge: {
        backgroundColor: '#3b82f6',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    speedText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    statusCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1e293b',
        margin: 20,
        padding: 16,
        borderRadius: 12,
    },
    statusIndicator: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#64748b',
        marginRight: 12,
    },
    statusActive: {
        backgroundColor: '#10b981',
    },
    statusText: {
        color: '#e2e8f0',
        fontSize: 16,
    },
    statsGrid: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        gap: 12,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#1e293b',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    statLabel: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 4,
    },
    detectionsList: {
        flex: 1,
        padding: 20,
    },
    detectionsTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#e2e8f0',
        marginBottom: 16,
    },
    emptyText: {
        color: '#64748b',
        textAlign: 'center',
        marginTop: 32,
    },
    detectionCard: {
        backgroundColor: '#1e293b',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#ef4444',
    },
    detectionType: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 4,
    },
    detectionInfo: {
        fontSize: 14,
        color: '#94a3b8',
        marginBottom: 4,
    },
    detectionTime: {
        fontSize: 12,
        color: '#64748b',
    },
    controlButton: {
        backgroundColor: '#10b981',
        margin: 20,
        padding: 20,
        borderRadius: 12,
        alignItems: 'center',
    },
    controlButtonActive: {
        backgroundColor: '#ef4444',
    },
    controlButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
})
