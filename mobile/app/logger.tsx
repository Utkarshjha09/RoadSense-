import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal } from 'react-native'
import { useRoadSensors } from '../src/hooks/useRoadSensors'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { theme } from '../src/theme'
import { appendLoggedSample, clearLoggedSamples, getLoggedSamples, LoggedSample } from '../src/services/data-logger.service'
import {
    enqueueAnomalyCsvUpload,
    flushPendingAnomalyCsvUploads,
    getPendingAnomalyCsvUploadCount,
} from '../src/services/supabase.service'

type SampleLabel = 'POTHOLE' | 'SPEED_BUMP' | 'NORMAL'
type PreviewRow = {
    point: string
    label: SampleLabel
    startTime: string
    endTime: string
    source: string
    latitude: string
    longitude: string
}

type SessionSummary = {
    id: string
    routeName: string
    source: 'driving' | 'logger'
    startIso: string
    endIso: string
    samples: LoggedSample[]
    hasAnomaly: boolean
}

const ROUTE_NAME = 'Bhopal-Sehore'
const SENSOR_INTERVAL_MS = 20
const SESSION_GAP_MS = 2 * 60 * 1000

export default function DataLogger() {
    const { isActive, currentWindow, sensorStats, start, stop } = useRoadSensors()
    const [collectedSamples, setCollectedSamples] = useState<LoggedSample[]>([])
    const [currentLabel, setCurrentLabel] = useState<SampleLabel | null>(null)
    const [exportPreviewVisible, setExportPreviewVisible] = useState(false)
    const [exportRows, setExportRows] = useState<PreviewRow[]>([])
    const [exportFileUri, setExportFileUri] = useState<string | null>(null)
    const [exportPickerVisible, setExportPickerVisible] = useState(false)
    const [pendingCloudUploads, setPendingCloudUploads] = useState(0)

    const sessionSummaries = useMemo(() => buildSessionSummaries(collectedSamples), [collectedSamples])

    const loadSamples = useCallback(async () => {
        const rows = await getLoggedSamples()
        setCollectedSamples(rows)
    }, [])

    useEffect(() => {
        void loadSamples()
        const interval = setInterval(() => {
            void loadSamples()
        }, 1200)

        return () => clearInterval(interval)
    }, [loadSamples])

    const syncPendingCloudUploads = useCallback(async () => {
        const result = await flushPendingAnomalyCsvUploads()
        if (result.uploaded > 0 || result.remaining >= 0) {
            const count = await getPendingAnomalyCsvUploadCount()
            setPendingCloudUploads(count)
        }
    }, [])

    useEffect(() => {
        void (async () => {
            const count = await getPendingAnomalyCsvUploadCount()
            setPendingCloudUploads(count)
            await syncPendingCloudUploads()
        })()

        const interval = setInterval(() => {
            void syncPendingCloudUploads()
        }, 20000)

        return () => clearInterval(interval)
    }, [syncPendingCloudUploads])

    async function handleLabelWindow(label: SampleLabel) {
        if (!currentWindow) {
            Alert.alert('No Data', 'No sensor window available. Start collection first.')
            return
        }

        const sample: LoggedSample = {
            id: `lbl-${Date.now()}-${Math.round(Math.random() * 100000)}`,
            timestamp: new Date().toISOString(),
            label,
            source: 'logger',
            data: currentWindow.data,
        }

        await appendLoggedSample(sample)
        await loadSamples()
        setCurrentLabel(label)
        setTimeout(() => setCurrentLabel(null), 1000)
    }

    async function createCsvFile(samples: LoggedSample[], prefix = 'roadsense_data') {
        let csv = 'route_name,window_start,window_end,label,accel_x,accel_y,accel_z,gyro_x,gyro_y,gyro_z,latitude,longitude,confidence,source\n'

        samples.forEach((sample) => {
            const rows = Array.isArray(sample.data) ? sample.data : []
            const startIso = new Date(sample.timestamp)
            const endIso = new Date(startIso.getTime() + Math.max(0, rows.length - 1) * SENSOR_INTERVAL_MS)
            const lat = typeof sample.latitude === 'number' ? sample.latitude : ''
            const lng = typeof sample.longitude === 'number' ? sample.longitude : ''
            const conf = typeof sample.confidence === 'number' ? sample.confidence : ''

            rows.forEach((row: number[]) => {
                csv += `${ROUTE_NAME},${startIso.toISOString()},${endIso.toISOString()},${sample.label},${row.join(',')},${lat},${lng},${conf},${sample.source}\n`
            })
        })

        const fileName = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}.csv`
        const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || ''
        const fileUri = `${baseDir}${fileName}`
        await FileSystem.writeAsStringAsync(fileUri, csv)
        return fileUri
    }

    async function shareCsvFile(fileUri: string, dialogTitle: string) {
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
                mimeType: 'text/csv',
                UTI: 'public.comma-separated-values-text',
                dialogTitle,
            })
            return
        }

        Alert.alert('Saved', `CSV saved at: ${fileUri}`)
    }

    async function exportSamplesAsCsv(samples: LoggedSample[], dialogTitle: string) {
        try {
            const fileUri = await createCsvFile(samples)
            await shareCsvFile(fileUri, dialogTitle)
        } catch (error) {
            console.error('Export error:', error)
            Alert.alert('Error', 'Failed to export data')
        }
    }

    async function exportToCSV() {
        if (collectedSamples.length === 0) {
            Alert.alert('No Data', 'Collect some samples first before exporting.')
            return
        }

        if (sessionSummaries.length <= 1) {
            const onlySession = sessionSummaries[0]
            if (onlySession) {
                await exportSamplesAsCsv(onlySession.samples, 'Export CSV')
            } else {
                await exportSamplesAsCsv(collectedSamples, 'Export CSV')
            }
            return
        }

        setExportPickerVisible(true)
    }

    async function openInExcelApp() {
        if (!exportFileUri) {
            Alert.alert('No file', 'Export file is not ready yet.')
            return
        }

        try {
            if (await Sharing.isAvailableAsync()) {
                await shareCsvFile(exportFileUri, 'Open in Excel app')
            }
        } catch (error) {
            console.error('Open in Excel failed:', error)
            Alert.alert('Error', 'Could not open sharing options.')
        }
    }

    async function openSessionPreview(session: SessionSummary) {
        try {
            const preview = session.samples.map((sample) => {
                const start = new Date(sample.timestamp)
                const rows = Array.isArray(sample.data) ? sample.data.length : 0
                const end = new Date(start.getTime() + Math.max(0, rows - 1) * SENSOR_INTERVAL_MS)
                const lat = typeof sample.latitude === 'number' ? sample.latitude.toFixed(6) : 'NA'
                const lng = typeof sample.longitude === 'number' ? sample.longitude.toFixed(6) : 'NA'
                return {
                    point: `${lat}, ${lng}`,
                    label: sample.label,
                    startTime: start.toLocaleTimeString(),
                    endTime: end.toLocaleTimeString(),
                    source: sample.source,
                    latitude: typeof sample.latitude === 'number' ? String(sample.latitude) : '',
                    longitude: typeof sample.longitude === 'number' ? String(sample.longitude) : '',
                }
            })

            const fileUri = await createCsvFile(session.samples)
            setExportRows(preview.slice(-120).reverse())
            setExportFileUri(fileUri)
            setExportPreviewVisible(true)
        } catch (error) {
            console.error('Session preview error:', error)
            Alert.alert('Error', 'Could not open session preview.')
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
                    onPress: () => {
                        void (async () => {
                            await clearLoggedSamples()
                            await loadSamples()
                        })()
                    },
                },
            ]
        )
    }

    async function exportSelectedSession(session: SessionSummary) {
        setExportPickerVisible(false)
        await exportSamplesAsCsv(session.samples, 'Export CSV')
    }

    async function exportAllSessions() {
        setExportPickerVisible(false)
        await exportSamplesAsCsv(collectedSamples, 'Export CSV')
    }

    function isAnomalyLabel(label: SampleLabel) {
        return label === 'POTHOLE' || label === 'SPEED_BUMP'
    }

    async function uploadRecentDrivingCsvToCloud() {
        const drivingSamples = collectedSamples.filter((sample) => sample.source === 'driving')
        if (drivingSamples.length === 0) {
            Alert.alert('No Driving Data', 'No recent driving samples found in Data Logger.')
            return
        }

        const anomalySamples = drivingSamples.filter((sample) => isAnomalyLabel(sample.label))

        try {
            // Create both files locally: full driving CSV and anomaly-only CSV.
            const fullFileUri = await createCsvFile(drivingSamples, 'roadsense_driving_full')
            const anomalyFileUri = await createCsvFile(anomalySamples, 'roadsense_driving_anomaly')

            if (anomalySamples.length === 0) {
                Alert.alert(
                    'No Anomaly Windows',
                    `Full CSV created locally at:\n${fullFileUri}\n\nNo anomaly rows to upload.`,
                )
                return
            }

            const anomalyFileName = `roadsense_anomaly_${Date.now()}.csv`
            await enqueueAnomalyCsvUpload(anomalyFileUri, anomalyFileName)
            const sync = await flushPendingAnomalyCsvUploads()
            const queueCount = await getPendingAnomalyCsvUploadCount()
            setPendingCloudUploads(queueCount)

            if (sync.uploaded > 0 && queueCount === 0) {
                Alert.alert(
                    'Cloud Upload Complete',
                    `Created full + anomaly CSV locally.\nUploaded anomaly CSV rows: ${anomalySamples.length}\nBucket: roadsense-logs`,
                )
            } else {
                Alert.alert(
                    'Queued For Auto Upload',
                    `No internet or upload temporary failed.\nQueued anomaly CSV files: ${queueCount}\nIt will auto-upload when internet is available.`,
                )
            }
        } catch (error) {
            console.error('Anomaly CSV upload failed:', error)
            Alert.alert('Upload Failed', 'Could not create/upload anomaly CSV.')
        }
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.hero}>
                <View>
                    <Text style={styles.kicker}>RoadSense Dataset</Text>
                    <Text style={styles.title}>Data Logger</Text>
                    <Text style={styles.subtitle}>Collect labeled windows for model training</Text>
                </View>
                <View style={[styles.statusBadge, isActive ? styles.statusActive : styles.statusIdle]}>
                    <Text style={styles.statusBadgeText}>{isActive ? 'LIVE' : 'IDLE'}</Text>
                </View>
            </View>

            <View style={styles.statsCard}>
                <StatItem label="Windows" value={String(sensorStats.windowCount)} />
                <StatItem label="Frequency" value={`${sensorStats.frequency.toFixed(0)} Hz`} />
                <StatItem label="Samples" value={String(collectedSamples.length)} />
            </View>

            <TouchableOpacity style={[styles.controlButton, isActive ? styles.stopButton : styles.startButton]} onPress={isActive ? stop : start}>
                <Text style={styles.controlButtonText}>{isActive ? 'Stop Collection' : 'Start Collection'}</Text>
            </TouchableOpacity>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Label Current Window</Text>
                <View style={styles.labelButtons}>
                    <LabelButton
                        text="Pothole"
                        style={[styles.labelButton, styles.potholeButton, currentLabel === 'POTHOLE' && styles.labelButtonActive]}
                        onPress={() => handleLabelWindow('POTHOLE')}
                        disabled={!isActive}
                    />
                    <LabelButton
                        text="Speed Bump"
                        style={[styles.labelButton, styles.bumpButton, currentLabel === 'SPEED_BUMP' && styles.labelButtonActive]}
                        onPress={() => handleLabelWindow('SPEED_BUMP')}
                        disabled={!isActive}
                    />
                    <LabelButton
                        text="Normal Road"
                        style={[styles.labelButton, styles.normalButton, currentLabel === 'NORMAL' && styles.labelButtonActive]}
                        onPress={() => handleLabelWindow('NORMAL')}
                        disabled={!isActive}
                    />
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recent Samples</Text>
                {collectedSamples.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No samples collected yet</Text>
                    </View>
                ) : (
                    <View style={styles.samplesList}>
                        {sessionSummaries.slice(-8).reverse().map((session) => (
                            <TouchableOpacity
                                key={session.id}
                                activeOpacity={0.9}
                                onPress={() => void openSessionPreview(session)}
                                style={[
                                    styles.sampleItem,
                                    session.hasAnomaly && styles.sampleItemAnomaly,
                                ]}
                            >
                                <Text style={styles.sampleLabel}>
                                    {session.routeName}
                                </Text>
                                <Text style={styles.sampleTime}>
                                    {formatSessionRange(session.startIso, session.endIso)} | {session.source}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>

            <View style={styles.actionsRow}>
                <TouchableOpacity style={[styles.actionButton, styles.exportButton]} onPress={exportToCSV} disabled={collectedSamples.length === 0}>
                    <Text style={styles.actionButtonText}>Export CSV</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, styles.clearButton]} onPress={clearData} disabled={collectedSamples.length === 0}>
                    <Text style={styles.actionButtonText}>Clear</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity
                style={[styles.actionButton, styles.cloudButton]}
                onPress={() => void uploadRecentDrivingCsvToCloud()}
                disabled={collectedSamples.length === 0}
            >
                <Text style={styles.actionButtonText}>Upload Anomaly CSV To Cloud</Text>
            </TouchableOpacity>
            <Text style={styles.pendingUploadsText}>Pending cloud uploads: {pendingCloudUploads}</Text>

            <View style={styles.instructionsCard}>
                <Text style={styles.instructionsTitle}>Workflow</Text>
                <Text style={styles.instructionsText}>1. Start collection</Text>
                <Text style={styles.instructionsText}>2. Drive and capture road condition</Text>
                <Text style={styles.instructionsText}>3. Label each window accurately</Text>
                <Text style={styles.instructionsText}>4. Create full + anomaly CSV locally</Text>
                <Text style={styles.instructionsText}>5. Upload only anomaly CSV to cloud</Text>
            </View>

            <Modal visible={exportPreviewVisible} transparent animationType="fade" onRequestClose={() => setExportPreviewVisible(false)}>
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>CSV Preview</Text>
                        <Text style={styles.modalSubTitle}>Route: {ROUTE_NAME}</Text>

                        <View style={styles.previewHeader}>
                            <Text style={[styles.previewHeaderCell, styles.previewColPoint]}>Lat,Lng</Text>
                            <Text style={[styles.previewHeaderCell, styles.previewColLabel]}>Label</Text>
                            <Text style={[styles.previewHeaderCell, styles.previewColTime]}>Start-End</Text>
                        </View>

                        <ScrollView style={styles.previewScroll}>
                            {exportRows.map((row, index) => (
                                <View
                                    key={`${row.startTime}-${row.endTime}-${index}`}
                                    style={[
                                        styles.previewRow,
                                        row.label !== 'NORMAL' && styles.previewRowAnomaly,
                                    ]}
                                >
                                    <Text style={[styles.previewCell, styles.previewColPoint]}>{row.point}</Text>
                                    <Text style={[styles.previewCell, styles.previewColLabel]}>{row.label}</Text>
                                    <Text style={[styles.previewCell, styles.previewColTime]}>{row.startTime} - {row.endTime}</Text>
                                </View>
                            ))}
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.actionButton, styles.exportButton]} onPress={() => void openInExcelApp()}>
                                <Text style={styles.actionButtonText}>Open in Excel App</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.actionButton, styles.clearButton]} onPress={() => setExportPreviewVisible(false)}>
                                <Text style={styles.actionButtonText}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={exportPickerVisible} transparent animationType="fade" onRequestClose={() => setExportPickerVisible(false)}>
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Export CSV</Text>
                        <Text style={styles.modalSubTitle}>Choose which driving session to export.</Text>

                        <ScrollView style={styles.exportPickerList}>
                            {sessionSummaries.slice().reverse().map((session) => (
                                <TouchableOpacity
                                    key={`export-${session.id}`}
                                    style={[styles.exportPickerRow, session.hasAnomaly && styles.previewRowAnomaly]}
                                    onPress={() => void exportSelectedSession(session)}
                                >
                                    <Text style={styles.exportPickerTitle}>{session.routeName}</Text>
                                    <Text style={styles.exportPickerMeta}>
                                        {formatSessionRange(session.startIso, session.endIso)} | {session.source} | {session.samples.length} windows
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.actionButton, styles.exportButton]} onPress={() => void exportAllSessions()}>
                                <Text style={styles.actionButtonText}>Export All</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.actionButton, styles.clearButton]} onPress={() => setExportPickerVisible(false)}>
                                <Text style={styles.actionButtonText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    )
}

function formatSessionRange(startIso: string, endIso: string) {
    const start = new Date(startIso)
    const end = new Date(endIso)
    return `${start.toLocaleTimeString()} - ${end.toLocaleTimeString()}`
}

function buildSessionSummaries(samples: LoggedSample[]) {
    const sorted = [...samples].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    if (sorted.length === 0) return []

    const sessions: SessionSummary[] = []

    for (const sample of sorted) {
        const sampleTs = new Date(sample.timestamp).getTime()
        const current = sessions[sessions.length - 1]
        if (!current) {
            sessions.push({
                id: `session-${sample.id}`,
                routeName: ROUTE_NAME,
                source: sample.source,
                startIso: sample.timestamp,
                endIso: sample.timestamp,
                samples: [sample],
                hasAnomaly: sample.label !== 'NORMAL',
            })
            continue
        }

        const currentEnd = new Date(current.endIso).getTime()
        const shouldSplit = sample.source !== current.source || sampleTs - currentEnd > SESSION_GAP_MS

        if (shouldSplit) {
            sessions.push({
                id: `session-${sample.id}`,
                routeName: ROUTE_NAME,
                source: sample.source,
                startIso: sample.timestamp,
                endIso: sample.timestamp,
                samples: [sample],
                hasAnomaly: sample.label !== 'NORMAL',
            })
            continue
        }

        current.samples.push(sample)
        current.endIso = sample.timestamp
        if (sample.label !== 'NORMAL') {
            current.hasAnomaly = true
        }
    }

    return sessions
}

function StatItem({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.statItem}>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    )
}

function LabelButton({ text, style, onPress, disabled }: { text: string; style: any; onPress: () => void; disabled: boolean }) {
    return (
        <TouchableOpacity style={style} onPress={onPress} disabled={disabled}>
            <Text style={styles.labelButtonText}>{text}</Text>
        </TouchableOpacity>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.bg,
    },
    content: {
        padding: 18,
        paddingTop: 46,
        paddingBottom: 24,
    },
    hero: {
        backgroundColor: theme.colors.panel,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.lg,
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 14,
    },
    kicker: {
        color: theme.colors.accent,
        fontSize: 11,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        fontWeight: '800',
    },
    title: {
        color: theme.colors.text,
        fontSize: 27,
        fontWeight: '800',
        marginTop: 4,
    },
    subtitle: {
        color: theme.colors.muted,
        fontSize: 13,
        marginTop: 6,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
    },
    statusActive: {
        backgroundColor: '#1c4f3d',
        borderColor: '#2d8b69',
    },
    statusIdle: {
        backgroundColor: '#2b3f56',
        borderColor: '#446383',
    },
    statusBadgeText: {
        color: theme.colors.text,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.8,
    },
    statsCard: {
        backgroundColor: theme.colors.panel,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.md,
        padding: 14,
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statValue: {
        color: theme.colors.text,
        fontSize: 20,
        fontWeight: '800',
    },
    statLabel: {
        color: theme.colors.muted,
        fontSize: 11,
        marginTop: 4,
    },
    controlButton: {
        borderRadius: 14,
        paddingVertical: 15,
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.22,
        shadowRadius: 14,
        elevation: 8,
    },
    startButton: {
        backgroundColor: theme.colors.accent,
        borderColor: '#8adfff',
    },
    stopButton: {
        backgroundColor: theme.colors.danger,
        borderColor: '#ff9c92',
    },
    controlButtonText: {
        color: '#f4fbff',
        fontSize: 15,
        fontWeight: '900',
        letterSpacing: 0.9,
        textTransform: 'uppercase',
    },
    section: {
        marginBottom: 16,
    },
    sectionTitle: {
        color: theme.colors.text,
        fontSize: 17,
        fontWeight: '800',
        marginBottom: 10,
    },
    labelButtons: {
        gap: 10,
    },
    labelButton: {
        paddingVertical: 14,
        borderRadius: 13,
        alignItems: 'center',
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 6,
    },
    labelButtonActive: {
        borderColor: '#d9eeff',
        shadowOpacity: 0.35,
    },
    potholeButton: {
        backgroundColor: '#7c2f39',
        borderColor: '#b85f6c',
    },
    bumpButton: {
        backgroundColor: theme.colors.accentWarm,
        borderColor: '#ffd18a',
    },
    normalButton: {
        backgroundColor: theme.colors.success,
        borderColor: '#8af0c8',
    },
    labelButtonText: {
        color: '#f6fbff',
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0.85,
        textTransform: 'uppercase',
    },
    emptyState: {
        backgroundColor: theme.colors.panel,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.md,
        paddingVertical: 18,
        alignItems: 'center',
    },
    emptyText: {
        color: theme.colors.muted,
        fontSize: 13,
    },
    samplesList: {
        gap: 8,
    },
    sampleItem: {
        backgroundColor: theme.colors.panel,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.sm,
        padding: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sampleItemAnomaly: {
        borderColor: '#7a5f2a',
        backgroundColor: '#2a2f46',
    },
    sampleLabel: {
        color: theme.colors.text,
        fontSize: 13,
        fontWeight: '700',
    },
    sampleTime: {
        color: theme.colors.muted,
        fontSize: 12,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    actionButton: {
        flex: 1,
        borderRadius: 13,
        paddingVertical: 13,
        alignItems: 'center',
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 8,
    },
    exportButton: {
        backgroundColor: theme.colors.panelSoft,
        borderColor: theme.colors.accent,
    },
    clearButton: {
        backgroundColor: '#4b3040',
        borderColor: '#8e5e72',
    },
    cloudButton: {
        backgroundColor: '#1f3f57',
        borderColor: '#66c8ff',
        marginBottom: 16,
    },
    actionButtonText: {
        color: '#f4fbff',
        fontWeight: '900',
        fontSize: 13,
        letterSpacing: 0.9,
        textTransform: 'uppercase',
    },
    pendingUploadsText: {
        color: theme.colors.muted,
        fontSize: 12,
        marginBottom: 14,
        textAlign: 'center',
    },
    instructionsCard: {
        backgroundColor: theme.colors.panel,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.md,
        padding: 14,
    },
    instructionsTitle: {
        color: theme.colors.text,
        fontWeight: '800',
        marginBottom: 8,
    },
    instructionsText: {
        color: theme.colors.muted,
        fontSize: 13,
        lineHeight: 20,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(1, 11, 24, 0.72)',
        justifyContent: 'center',
        padding: 16,
    },
    modalCard: {
        backgroundColor: theme.colors.panel,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.lg,
        padding: 14,
        maxHeight: '86%',
    },
    modalTitle: {
        color: theme.colors.text,
        fontSize: 18,
        fontWeight: '800',
    },
    modalSubTitle: {
        color: theme.colors.muted,
        marginTop: 4,
        marginBottom: 10,
    },
    previewHeader: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        paddingBottom: 8,
        marginBottom: 6,
        columnGap: 10,
    },
    previewHeaderCell: {
        color: theme.colors.accent,
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    previewScroll: {
        maxHeight: 380,
    },
    previewRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.sm,
        paddingVertical: 8,
        paddingHorizontal: 8,
        marginBottom: 6,
        backgroundColor: theme.colors.bgElevated,
        columnGap: 10,
    },
    previewRowAnomaly: {
        borderColor: '#7a5f2a',
        backgroundColor: '#2a2f46',
    },
    previewCell: {
        color: theme.colors.text,
        fontSize: 12,
        fontWeight: '600',
    },
    previewColPoint: {
        flex: 1.6,
        paddingRight: 10,
    },
    previewColLabel: {
        flex: 1,
        paddingHorizontal: 4,
    },
    previewColTime: {
        flex: 1.8,
        textAlign: 'right',
        paddingLeft: 10,
    },
    exportPickerList: {
        maxHeight: 340,
    },
    exportPickerRow: {
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.sm,
        paddingVertical: 10,
        paddingHorizontal: 10,
        marginBottom: 8,
        backgroundColor: theme.colors.bgElevated,
    },
    exportPickerTitle: {
        color: theme.colors.text,
        fontSize: 14,
        fontWeight: '800',
    },
    exportPickerMeta: {
        color: theme.colors.muted,
        fontSize: 12,
        marginTop: 4,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 10,
    },
})
