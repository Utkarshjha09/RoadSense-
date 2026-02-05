import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native'
import { useRoadSensors } from '../src/hooks/useRoadSensors'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'

export default function DataLogger() {
    const { isActive, currentWindow, sensorStats, start, stop } = useRoadSensors()
    const [collectedSamples, setCollectedSamples] = useState<any[]>([])
    const [currentLabel, setCurrentLabel] = useState<'POTHOLE' | 'SPEED_BUMP' | 'NORMAL' | null>(null)

    function handleLabelWindow(label: 'POTHOLE' | 'SPEED_BUMP' | 'NORMAL') {
        if (!currentWindow) {
            Alert.alert('No Data', 'No sensor window available. Start collection first.')
            return
        }

        const sample = {
            timestamp: new Date().toISOString(),
            label,
            data: currentWindow,
        }

        setCollectedSamples([...collectedSamples, sample])
        setCurrentLabel(label)

        // Visual feedback
        setTimeout(() => setCurrentLabel(null), 1000)
    }

    async function exportToCSV() {
        if (collectedSamples.length === 0) {
            Alert.alert('No Data', 'Collect some samples first before exporting.')
            return
        }

        try {
            // Create CSV header
            let csv = 'timestamp,label,accel_x,accel_y,accel_z,gyro_x,gyro_y,gyro_z\n'

            // Add each sample (flatten the 100x6 window)
            collectedSamples.forEach((sample) => {
                sample.data.forEach((row: number[]) => {
                    csv += `${sample.timestamp},${sample.label},${row.join(',')}\n`
                })
            })

            // Save to file
            const fileName = `roadsense_data_${Date.now()}.csv`
            const fileUri = FileSystem.documentDirectory + fileName

            await FileSystem.writeAsStringAsync(fileUri, csv)

            // Share file
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri)
            } else {
                Alert.alert('Success', `Data saved to ${fileUri}`)
            }
        } catch (error) {
            console.error('Export error:', error)
            Alert.alert('Error', 'Failed to export data')
        }
    }

    function clearData() {
        Alert.alert(
            'Clear Data',
            'Are you sure you want to clear all collected samples?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: () => setCollectedSamples([]),
                },
            ]
        )
    }

    return (
        <ScrollView style={styles.container}>
            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Data Logger</Text>
                    <Text style={styles.subtitle}>Collect labeled training data</Text>
                </View>

                {/* Status Card */}
                <View style={styles.card}>
                    <View style={styles.statusRow}>
                        <Text style={styles.label}>Collection Status</Text>
                        <View style={[styles.badge, isActive ? styles.badgeActive : styles.badgeInactive]}>
                            <Text style={styles.badgeText}>{isActive ? 'Active' : 'Stopped'}</Text>
                        </View>
                    </View>
                    <View style={styles.statsRow}>
                        <View style={styles.stat}>
                            <Text style={styles.statValue}>{sensorStats.windowCount}</Text>
                            <Text style={styles.statLabel}>Windows</Text>
                        </View>
                        <View style={styles.stat}>
                            <Text style={styles.statValue}>{sensorStats.frequency.toFixed(0)} Hz</Text>
                            <Text style={styles.statLabel}>Frequency</Text>
                        </View>
                        <View style={styles.stat}>
                            <Text style={styles.statValue}>{collectedSamples.length}</Text>
                            <Text style={styles.statLabel}>Samples</Text>
                        </View>
                    </View>
                </View>

                {/* Control Button */}
                <TouchableOpacity
                    style={[styles.controlButton, isActive ? styles.stopButton : styles.startButton]}
                    onPress={isActive ? stop : start}
                >
                    <Text style={styles.controlButtonText}>
                        {isActive ? '⏸️ Stop Collection' : '▶️ Start Collection'}
                    </Text>
                </TouchableOpacity>

                {/* Label Buttons */}
                <View style={styles.labelSection}>
                    <Text style={styles.sectionTitle}>Label Current Window</Text>
                    <View style={styles.labelButtons}>
                        <TouchableOpacity
                            style={[
                                styles.labelButton,
                                styles.potholeButton,
                                currentLabel === 'POTHOLE' && styles.labelButtonActive,
                            ]}
                            onPress={() => handleLabelWindow('POTHOLE')}
                            disabled={!isActive}
                        >
                            <Text style={styles.labelButtonText}>🕳️ Pothole</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.labelButton,
                                styles.bumpButton,
                                currentLabel === 'SPEED_BUMP' && styles.labelButtonActive,
                            ]}
                            onPress={() => handleLabelWindow('SPEED_BUMP')}
                            disabled={!isActive}
                        >
                            <Text style={styles.labelButtonText}>🚧 Speed Bump</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.labelButton,
                                styles.normalButton,
                                currentLabel === 'NORMAL' && styles.labelButtonActive,
                            ]}
                            onPress={() => handleLabelWindow('NORMAL')}
                            disabled={!isActive}
                        >
                            <Text style={styles.labelButtonText}>✅ Normal Road</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Collected Samples */}
                <View style={styles.samplesSection}>
                    <Text style={styles.sectionTitle}>Collected Samples</Text>
                    {collectedSamples.length === 0 ? (
                        <Text style={styles.emptyText}>No samples collected yet</Text>
                    ) : (
                        <View style={styles.samplesList}>
                            {collectedSamples.slice(-10).reverse().map((sample, index) => (
                                <View key={index} style={styles.sampleItem}>
                                    <View style={styles.sampleInfo}>
                                        <Text style={styles.sampleLabel}>
                                            {sample.label === 'POTHOLE' ? '🕳️' : sample.label === 'SPEED_BUMP' ? '🚧' : '✅'}{' '}
                                            {sample.label}
                                        </Text>
                                        <Text style={styles.sampleTime}>
                                            {new Date(sample.timestamp).toLocaleTimeString()}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </View>

                {/* Export Buttons */}
                <View style={styles.exportSection}>
                    <TouchableOpacity
                        style={[styles.exportButton, styles.exportPrimary]}
                        onPress={exportToCSV}
                        disabled={collectedSamples.length === 0}
                    >
                        <Text style={styles.exportButtonText}>📤 Export CSV</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.exportButton, styles.exportDanger]}
                        onPress={clearData}
                        disabled={collectedSamples.length === 0}
                    >
                        <Text style={styles.exportButtonText}>🗑️ Clear Data</Text>
                    </TouchableOpacity>
                </View>

                {/* Instructions */}
                <View style={styles.instructions}>
                    <Text style={styles.instructionsTitle}>How to Use:</Text>
                    <Text style={styles.instructionsText}>
                        1. Start collection{'\n'}
                        2. Drive over a pothole, speed bump, or normal road{'\n'}
                        3. Tap the appropriate label button{'\n'}
                        4. Repeat for multiple samples{'\n'}
                        5. Export to CSV for training
                    </Text>
                </View>
            </View>
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    content: {
        padding: 20,
    },
    header: {
        marginBottom: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: '#94a3b8',
    },
    card: {
        backgroundColor: '#1e293b',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#334155',
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    label: {
        fontSize: 16,
        color: '#cbd5e1',
        fontWeight: '600',
    },
    badge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    badgeActive: {
        backgroundColor: '#10b981',
    },
    badgeInactive: {
        backgroundColor: '#64748b',
    },
    badgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    stat: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: '#94a3b8',
    },
    controlButton: {
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 24,
    },
    startButton: {
        backgroundColor: '#3b82f6',
    },
    stopButton: {
        backgroundColor: '#ef4444',
    },
    controlButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    labelSection: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 12,
    },
    labelButtons: {
        gap: 12,
    },
    labelButton: {
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    labelButtonActive: {
        borderColor: '#fff',
        transform: [{ scale: 0.95 }],
    },
    potholeButton: {
        backgroundColor: '#dc2626',
    },
    bumpButton: {
        backgroundColor: '#f59e0b',
    },
    normalButton: {
        backgroundColor: '#10b981',
    },
    labelButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    samplesSection: {
        marginBottom: 24,
    },
    emptyText: {
        color: '#64748b',
        fontSize: 14,
        textAlign: 'center',
        paddingVertical: 20,
    },
    samplesList: {
        gap: 8,
    },
    sampleItem: {
        backgroundColor: '#1e293b',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#334155',
    },
    sampleInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sampleLabel: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    sampleTime: {
        color: '#94a3b8',
        fontSize: 12,
    },
    exportSection: {
        gap: 12,
        marginBottom: 24,
    },
    exportButton: {
        padding: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    exportPrimary: {
        backgroundColor: '#3b82f6',
    },
    exportDanger: {
        backgroundColor: '#64748b',
    },
    exportButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    instructions: {
        backgroundColor: '#1e293b',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#334155',
    },
    instructionsTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
    },
    instructionsText: {
        fontSize: 14,
        color: '#94a3b8',
        lineHeight: 20,
    },
})
