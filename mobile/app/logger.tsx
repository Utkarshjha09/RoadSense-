import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { FileText, Cloud, Play, Square, X, Database, AlertTriangle, Activity, Clock } from 'lucide-react-native'
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
import { BottomNavBar } from '../components/bottom-nav-bar'
import { Pill } from '../components/ui-kit'
import { GroupedBarChart, BarSeriesPoint } from '../components/grouped-bar-chart'

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

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

type PreviewSessionInfo = {
    routeName: string
    source: 'driving' | 'logger'
    startIso: string
    endIso: string
}

const ROUTE_NAME = 'Bhopal-Sehore'
const SENSOR_INTERVAL_MS = 20
const SESSION_GAP_MS = 2 * 60 * 1000

export default function DataLogger() {
    const insets = useSafeAreaInsets()
    const { isActive, currentWindow, sensorStats, start, stop } = useRoadSensors()
    const [collectedSamples, setCollectedSamples] = useState<LoggedSample[]>([])
    const [currentLabel, setCurrentLabel] = useState<SampleLabel | null>(null)
    const [exportPreviewVisible, setExportPreviewVisible] = useState(false)
    const [exportRows, setExportRows] = useState<PreviewRow[]>([])
    const [exportFileUri, setExportFileUri] = useState<string | null>(null)
    const [previewSessionInfo, setPreviewSessionInfo] = useState<PreviewSessionInfo | null>(null)
    const [exportPickerVisible, setExportPickerVisible] = useState(false)
    const [pendingCloudUploads, setPendingCloudUploads] = useState(0)

    const sessionSummaries = useMemo(() => buildSessionSummaries(collectedSamples), [collectedSamples])
    const recentDrivingSessions = useMemo(
        () => sessionSummaries.filter((session) => session.source === 'driving'),
        [sessionSummaries]
    )

    const datasetStats = useMemo(() => {
        const potholes = collectedSamples.filter((s) => s.label === 'POTHOLE').length
        const bumps = collectedSamples.filter((s) => s.label === 'SPEED_BUMP').length
        return {
            totalRecords: collectedSamples.length,
            potholes,
            bumps,
            sessions: sessionSummaries.length,
        }
    }, [collectedSamples, sessionSummaries])

    const timelineChart = useMemo<BarSeriesPoint[]>(() => {
        const days: { date: Date; potholes: number; bumps: number }[] = []
        for (let i = 6; i >= 0; i -= 1) {
            const d = new Date()
            d.setDate(d.getDate() - i)
            days.push({ date: d, potholes: 0, bumps: 0 })
        }

        collectedSamples.forEach((sample) => {
            const sampleDate = new Date(sample.timestamp)
            const match = days.find((d) => isSameDay(d.date, sampleDate))
            if (!match) return
            if (sample.label === 'POTHOLE') match.potholes += 1
            if (sample.label === 'SPEED_BUMP') match.bumps += 1
        })

        return days.map((d) => ({
            label: DAY_LABELS[d.date.getDay()],
            values: [
                { value: d.potholes, color: theme.colors.danger },
                { value: d.bumps, color: theme.colors.accentWarm },
            ],
        }))
    }, [collectedSamples])

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
            setPreviewSessionInfo({
                routeName: session.routeName,
                source: session.source,
                startIso: session.startIso,
                endIso: session.endIso,
            })
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
        const latestDrivingSession = recentDrivingSessions[recentDrivingSessions.length - 1]
        if (!latestDrivingSession) {
            Alert.alert('No Driving Data', 'No recent driving samples found in Data Logger.')
            return
        }

        const drivingSamples = latestDrivingSession.samples
        const anomalySamples = drivingSamples.filter((sample) => isAnomalyLabel(sample.label))

        try {
            // Create both files locally: full driving CSV and anomaly-only CSV.
            const fullFileUri = await createCsvFile(drivingSamples, 'roadsense_driving_full')
            const anomalyFileUri = await createCsvFile(anomalySamples, 'roadsense_driving_anomaly')

            if (anomalySamples.length === 0) {
                Alert.alert(
                    'No Anomaly Windows',
                    `Full CSV created locally for ${latestDrivingSession.routeName} (${formatSessionRange(latestDrivingSession.startIso, latestDrivingSession.endIso)}).\n\nPath:\n${fullFileUri}\n\nNo anomaly rows to upload.`,
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
                    `Route: ${latestDrivingSession.routeName}\nSession: ${formatSessionRange(latestDrivingSession.startIso, latestDrivingSession.endIso)}\n\nCreated full + anomaly CSV locally.\nUploaded anomaly CSV rows: ${anomalySamples.length}\nBucket: roadsense-logs`,
                )
            } else {
                const errorLine = sync.errorMessage ? `\n\nLast upload error:\n${sync.errorMessage}` : ''
                Alert.alert(
                    'Queued For Auto Upload',
                    `Route: ${latestDrivingSession.routeName}\nSession: ${formatSessionRange(latestDrivingSession.startIso, latestDrivingSession.endIso)}\n\nNo internet or upload temporary failed.\nQueued anomaly CSV files: ${queueCount}\nIt will auto-upload when internet is available.${errorLine}`,
                )
            }
        } catch (error) {
            console.error('Anomaly CSV upload failed:', error)
            Alert.alert('Upload Failed', 'Could not create/upload anomaly CSV.')
        }
    }

    return (
        <View style={styles.screen}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: 128 }]}
            >
                <View style={styles.hero}>
                    <View style={styles.heroCopy}>
                        <Text style={styles.kicker}>RoadSense Dataset</Text>
                        <Text style={styles.title}>Data Logger</Text>
                        <Text style={styles.subtitle}>Collect labeled windows for model training</Text>
                    </View>
                    <Pill tone={isActive ? 'green' : 'dim'} size="xs">{isActive ? 'LIVE' : 'IDLE'}</Pill>
                </View>

                <View style={styles.statsCard}>
                    <StatItem label="Windows" value={String(sensorStats.windowCount)} />
                    <StatItem label="Frequency" value={`${sensorStats.frequency.toFixed(0)} Hz`} />
                    <StatItem label="Samples" value={String(collectedSamples.length)} />
                </View>

                <TouchableOpacity style={[styles.controlButton, isActive ? styles.stopButton : styles.startButton]} onPress={isActive ? stop : start}>
                    {isActive ? <Square size={15} color={theme.colors.bg} /> : <Play size={15} color={theme.colors.bg} />}
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
                    <Text style={styles.sectionTitle}>Detection Timeline (7 days)</Text>
                    <View style={styles.timelineCard}>
                        <GroupedBarChart data={timelineChart} />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Dataset Statistics</Text>
                    <View style={styles.statsGrid}>
                        <DatasetStatTile icon={<Database size={14} color={theme.colors.accent} />} label="Total Records" value={String(datasetStats.totalRecords)} />
                        <DatasetStatTile icon={<AlertTriangle size={14} color={theme.colors.danger} />} label="Potholes" value={String(datasetStats.potholes)} />
                        <DatasetStatTile icon={<Activity size={14} color={theme.colors.accentWarm} />} label="Speed Bumps" value={String(datasetStats.bumps)} />
                        <DatasetStatTile icon={<Clock size={14} color={theme.colors.accentIndigo} />} label="Sessions" value={String(datasetStats.sessions)} />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Recent Samples</Text>
                    {recentDrivingSessions.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Database size={20} color={theme.colors.muted2} />
                            <Text style={styles.emptyText}>No driving route sessions yet</Text>
                        </View>
                    ) : (
                        <View style={styles.samplesList}>
                            {recentDrivingSessions.slice(-8).reverse().map((session) => (
                                <TouchableOpacity
                                    key={session.id}
                                    activeOpacity={0.9}
                                    onPress={() => void openSessionPreview(session)}
                                    style={[
                                        styles.sampleItem,
                                        session.hasAnomaly && styles.sampleItemAnomaly,
                                    ]}
                                >
                                    <View style={styles.sampleIconWrap}>
                                        <Database size={14} color={theme.colors.accent} />
                                    </View>
                                    <View style={styles.sampleTextWrap}>
                                        <Text style={styles.sampleLabel}>
                                            {session.routeName}
                                        </Text>
                                        <Text style={styles.sampleTime}>
                                            {formatSessionRange(session.startIso, session.endIso)} &middot; {session.source}
                                        </Text>
                                    </View>
                                    {session.hasAnomaly ? <Pill tone="amber" size="xs">Anomaly</Pill> : null}
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>

                <View style={styles.actionsRow}>
                    <TouchableOpacity style={[styles.actionButton, styles.exportButton]} onPress={exportToCSV} disabled={collectedSamples.length === 0}>
                        <FileText size={14} color={theme.colors.accent} />
                        <Text style={[styles.actionButtonText, styles.exportButtonText]}>Export CSV</Text>
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
                    <Cloud size={14} color={theme.colors.accentIndigo} />
                    <Text style={[styles.actionButtonText, styles.cloudButtonText]}>Upload Anomaly CSV To Cloud</Text>
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
                            <View style={styles.modalHeaderRow}>
                                <View>
                                    <Text style={styles.modalTitle}>CSV Preview</Text>
                                    <Text style={styles.modalSubTitle}>
                                        Route: {previewSessionInfo?.routeName || ROUTE_NAME}
                                    </Text>
                                    {previewSessionInfo ? (
                                        <Text style={styles.modalSubTitle}>
                                            {formatSessionRange(previewSessionInfo.startIso, previewSessionInfo.endIso)} &middot; {previewSessionInfo.source}
                                        </Text>
                                    ) : null}
                                </View>
                                <TouchableOpacity
                                    style={styles.modalCloseButton}
                                    onPress={() => {
                                        setExportPreviewVisible(false)
                                        setPreviewSessionInfo(null)
                                    }}
                                >
                                    <X size={15} color={theme.colors.muted} />
                                </TouchableOpacity>
                            </View>

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
                                    <Text style={[styles.actionButtonText, styles.exportButtonText]}>Open in Excel App</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actionButton, styles.clearButton]}
                                    onPress={() => {
                                        setExportPreviewVisible(false)
                                        setPreviewSessionInfo(null)
                                    }}
                                >
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
                                            {formatSessionRange(session.startIso, session.endIso)} &middot; {session.source} &middot; {session.samples.length} windows
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <View style={styles.modalActions}>
                                <TouchableOpacity style={[styles.actionButton, styles.exportButton]} onPress={() => void exportAllSessions()}>
                                    <Text style={[styles.actionButtonText, styles.exportButtonText]}>Export All</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.actionButton, styles.clearButton]} onPress={() => setExportPickerVisible(false)}>
                                    <Text style={styles.actionButtonText}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </ScrollView>
            <BottomNavBar active="logger" />
        </View>
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

function DatasetStatTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
    return (
        <View style={styles.datasetTile}>
            {icon}
            <Text style={styles.datasetTileValue}>{value}</Text>
            <Text style={styles.datasetTileLabel}>{label}</Text>
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
    screen: {
        flex: 1,
        backgroundColor: theme.colors.bg,
    },
    container: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 18,
    },
    hero: {
        backgroundColor: theme.colors.panel,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.xl,
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 14,
    },
    heroCopy: {
        flex: 1,
    },
    kicker: {
        color: theme.colors.accent,
        fontFamily: theme.fonts.bodyBold,
        fontSize: 11,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
    },
    title: {
        color: theme.colors.text,
        fontFamily: theme.fonts.display,
        fontSize: 24,
        marginTop: 4,
        letterSpacing: -0.5,
    },
    subtitle: {
        color: theme.colors.muted,
        fontFamily: theme.fonts.body,
        fontSize: 12,
        marginTop: 6,
    },
    statsCard: {
        backgroundColor: theme.colors.panel,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.lg,
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
        fontFamily: theme.fonts.display,
        fontSize: 19,
    },
    statLabel: {
        color: theme.colors.muted,
        fontFamily: theme.fonts.body,
        fontSize: 10,
        marginTop: 4,
    },
    controlButton: {
        borderRadius: theme.radius.lg,
        paddingVertical: 15,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    startButton: {
        backgroundColor: theme.colors.accent,
    },
    stopButton: {
        backgroundColor: theme.colors.danger,
    },
    controlButtonText: {
        color: theme.colors.bg,
        fontFamily: theme.fonts.bodyBold,
        fontSize: 14,
        letterSpacing: 0.5,
    },
    section: {
        marginBottom: 16,
    },
    sectionTitle: {
        color: theme.colors.text,
        fontFamily: theme.fonts.bodyBold,
        fontSize: 15,
        marginBottom: 10,
    },
    timelineCard: {
        backgroundColor: theme.colors.panel,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.lg,
        padding: 14,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    datasetTile: {
        width: '47%',
        backgroundColor: theme.colors.panel,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.lg,
        padding: 14,
        gap: 8,
    },
    datasetTileValue: {
        color: theme.colors.text,
        fontFamily: theme.fonts.display,
        fontSize: 20,
    },
    datasetTileLabel: {
        color: theme.colors.muted,
        fontFamily: theme.fonts.body,
        fontSize: 10,
    },
    labelButtons: {
        gap: 10,
    },
    labelButton: {
        paddingVertical: 14,
        borderRadius: theme.radius.lg,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    labelButtonActive: {
        borderColor: theme.colors.text,
    },
    potholeButton: {
        backgroundColor: 'rgba(248,113,113,0.14)',
        borderColor: 'rgba(248,113,113,0.3)',
    },
    bumpButton: {
        backgroundColor: 'rgba(251,191,36,0.14)',
        borderColor: 'rgba(251,191,36,0.3)',
    },
    normalButton: {
        backgroundColor: 'rgba(129,140,248,0.14)',
        borderColor: 'rgba(129,140,248,0.3)',
    },
    labelButtonText: {
        color: theme.colors.text,
        fontFamily: theme.fonts.bodyBold,
        fontSize: 13,
        letterSpacing: 0.4,
    },
    emptyState: {
        backgroundColor: theme.colors.panel,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.lg,
        paddingVertical: 22,
        alignItems: 'center',
        gap: 8,
    },
    emptyText: {
        color: theme.colors.muted,
        fontFamily: theme.fonts.body,
        fontSize: 13,
    },
    samplesList: {
        gap: 8,
    },
    sampleItem: {
        backgroundColor: theme.colors.panel,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.md,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    sampleItemAnomaly: {
        borderColor: 'rgba(251,191,36,0.28)',
    },
    sampleIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: 'rgba(34,211,238,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(34,211,238,0.16)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sampleTextWrap: {
        flex: 1,
    },
    sampleLabel: {
        color: theme.colors.text,
        fontFamily: theme.fonts.bodySemiBold,
        fontSize: 13,
    },
    sampleTime: {
        color: theme.colors.muted,
        fontFamily: theme.fonts.body,
        fontSize: 11,
        marginTop: 2,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 12,
    },
    actionButton: {
        flex: 1,
        borderRadius: theme.radius.lg,
        paddingVertical: 13,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    exportButton: {
        backgroundColor: theme.colors.panel,
        borderColor: 'rgba(34,211,238,0.24)',
    },
    exportButtonText: {
        color: theme.colors.accent,
    },
    clearButton: {
        backgroundColor: theme.colors.panel,
        borderColor: 'rgba(248,113,113,0.24)',
    },
    cloudButton: {
        backgroundColor: theme.colors.panel,
        borderColor: 'rgba(129,140,248,0.26)',
        marginBottom: 8,
    },
    cloudButtonText: {
        color: theme.colors.accentIndigo,
    },
    actionButtonText: {
        color: theme.colors.text,
        fontFamily: theme.fonts.bodySemiBold,
        fontSize: 13,
    },
    pendingUploadsText: {
        color: theme.colors.muted2,
        fontFamily: theme.fonts.body,
        fontSize: 11,
        marginBottom: 14,
        textAlign: 'center',
    },
    instructionsCard: {
        backgroundColor: theme.colors.panel,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.lg,
        padding: 14,
    },
    instructionsTitle: {
        color: theme.colors.text,
        fontFamily: theme.fonts.bodyBold,
        fontSize: 13,
        marginBottom: 8,
    },
    instructionsText: {
        color: theme.colors.muted,
        fontFamily: theme.fonts.body,
        fontSize: 12,
        lineHeight: 19,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(1, 4, 9, 0.8)',
        justifyContent: 'center',
        padding: 16,
    },
    modalCard: {
        backgroundColor: theme.colors.panel,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.xl,
        padding: 16,
        maxHeight: '86%',
    },
    modalHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    modalCloseButton: {
        width: 30,
        height: 30,
        borderRadius: 10,
        backgroundColor: theme.colors.panelSoft,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalTitle: {
        color: theme.colors.text,
        fontFamily: theme.fonts.display,
        fontSize: 18,
    },
    modalSubTitle: {
        color: theme.colors.muted,
        fontFamily: theme.fonts.body,
        fontSize: 12,
        marginTop: 4,
    },
    previewHeader: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        paddingBottom: 8,
        marginTop: 14,
        marginBottom: 6,
        columnGap: 10,
    },
    previewHeaderCell: {
        color: theme.colors.accent,
        fontFamily: theme.fonts.bodyBold,
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
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
        borderColor: 'rgba(251,191,36,0.28)',
        backgroundColor: 'rgba(251,191,36,0.06)',
    },
    previewCell: {
        color: theme.colors.text,
        fontFamily: theme.fonts.mono,
        fontSize: 11,
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
        marginTop: 12,
    },
    exportPickerRow: {
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.md,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginBottom: 8,
        backgroundColor: theme.colors.bgElevated,
    },
    exportPickerTitle: {
        color: theme.colors.text,
        fontFamily: theme.fonts.bodyBold,
        fontSize: 13,
    },
    exportPickerMeta: {
        color: theme.colors.muted,
        fontFamily: theme.fonts.body,
        fontSize: 11,
        marginTop: 4,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 12,
    },
})
