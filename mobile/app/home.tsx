import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { router, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Location from 'expo-location'
import { Bell, Settings, Car, Route, MapPin, AlertTriangle, Activity } from 'lucide-react-native'
import { isSupabaseConfigured, supabase } from '../src/services/supabase.service'
import { theme } from '../src/theme'
import { getLoggedSamples, LoggedSample } from '../src/services/data-logger.service'
import {
    DeviceConnectionConfig,
    DEFAULT_DEVICE_CONNECTION,
    Esp32ConnectionState,
    getDeviceConnectionConfig,
    getEsp32ConnectionState,
} from '../src/services/device-connection.service'
import { BottomNavBar } from '../components/bottom-nav-bar'
import { Pill } from '../components/ui-kit'
import { GroupedBarChart, BarSeriesPoint } from '../components/grouped-bar-chart'

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const GPS_STALE_MS = 2 * 60 * 1000

export default function HomeScreen() {
    const insets = useSafeAreaInsets()
    const [displayName, setDisplayName] = useState('Explorer')
    const [initials, setInitials] = useState('?')
    const [samples, setSamples] = useState<LoggedSample[]>([])
    const [gpsStatus, setGpsStatus] = useState<'checking' | 'connected' | 'off' | 'denied'>('checking')
    const [connection, setConnection] = useState<DeviceConnectionConfig>(DEFAULT_DEVICE_CONNECTION)
    const [esp32State, setEsp32State] = useState<{ state: Esp32ConnectionState; updatedAt: number | null }>({
        state: 'idle',
        updatedAt: null,
    })

    useEffect(() => {
        if (!isSupabaseConfigured) {
            return
        }

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                const name = getDisplayName(session.user)
                setDisplayName(name)
                setInitials(getInitials(name))
            }
        })

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                const name = getDisplayName(session.user)
                setDisplayName(name)
                setInitials(getInitials(name))
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    useFocusEffect(
        useCallback(() => {
            void getLoggedSamples().then(setSamples)
            void getDeviceConnectionConfig().then(setConnection)
            void getEsp32ConnectionState().then(setEsp32State)

            let cancelled = false
            void (async () => {
                try {
                    const servicesEnabled = await Location.hasServicesEnabledAsync()
                    if (!servicesEnabled) {
                        if (!cancelled) setGpsStatus('off')
                        return
                    }
                    const { status } = await Location.getForegroundPermissionsAsync()
                    if (!cancelled) setGpsStatus(status === 'granted' ? 'connected' : 'denied')
                } catch {
                    if (!cancelled) setGpsStatus('off')
                }
            })()

            return () => {
                cancelled = true
            }
        }, [])
    )

    const greeting = useMemo(() => {
        const hour = new Date().getHours()
        if (hour < 12) return 'Good morning'
        if (hour < 18) return 'Good afternoon'
        return 'Good evening'
    }, [])

    const dateLabel = useMemo(() => formatDateKicker(new Date()), [])

    const gpsLabel =
        gpsStatus === 'checking' ? 'Checking...' : gpsStatus === 'connected' ? 'Connected' : gpsStatus === 'denied' ? 'No Permission' : 'Off'
    const gpsColor = gpsStatus === 'connected' ? theme.colors.success : gpsStatus === 'checking' ? theme.colors.muted2 : theme.colors.danger

    const esp32Fresh = esp32State.updatedAt !== null && Date.now() - esp32State.updatedAt < GPS_STALE_MS
    const esp32Connected = esp32Fresh && esp32State.state === 'connected'
    const sensorLabel = connection.sensorSource === 'phone' ? 'Phone' : 'ESP32'
    const sensorSubLabel = connection.sensorSource === 'esp32' ? (esp32Connected ? 'Connected' : 'Not connected') : 'Sensor'
    const sensorColor = connection.sensorSource === 'phone' ? theme.colors.accentIndigo : esp32Connected ? theme.colors.success : theme.colors.muted

    const todayStats = useMemo(() => {
        const today = new Date()
        const todaySamples = samples.filter((sample) => isSameDay(new Date(sample.timestamp), today))
        return {
            samples: todaySamples.length,
            potholes: todaySamples.filter((s) => s.label === 'POTHOLE').length,
            bumps: todaySamples.filter((s) => s.label === 'SPEED_BUMP').length,
        }
    }, [samples])

    const weeklyChart = useMemo<BarSeriesPoint[]>(() => {
        const days: { date: Date; potholes: number; bumps: number }[] = []
        for (let i = 6; i >= 0; i -= 1) {
            const d = new Date()
            d.setDate(d.getDate() - i)
            days.push({ date: d, potholes: 0, bumps: 0 })
        }

        samples.forEach((sample) => {
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
    }, [samples])

    const recentDetections = useMemo(() => {
        return samples
            .filter((s) => s.label === 'POTHOLE' || s.label === 'SPEED_BUMP')
            .slice(-5)
            .reverse()
    }, [samples])

    return (
        <View style={styles.screen}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={[styles.content, { paddingTop: insets.top + 14, paddingBottom: 128 }]}
            >
                <View style={styles.glowTop} />
                <View style={styles.glowBottom} />

                <View style={styles.headerRow}>
                    <View style={styles.headerCopy}>
                        <Text style={styles.kicker}>{dateLabel}</Text>
                        <Text style={styles.title}>{greeting}, {displayName}</Text>
                    </View>
                    <View style={styles.headerActions}>
                        <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/notifications')}>
                            <Bell size={16} color={theme.colors.muted} />
                            <View style={styles.notifDot} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/settings')}>
                            <Settings size={16} color={theme.colors.muted} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.avatarButton} onPress={() => router.push('/account')}>
                            <Text style={styles.avatarButtonText}>{initials}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.statusStrip}>
                    <View style={styles.statusTopRow}>
                        <View style={styles.statusDotRow}>
                            <View style={styles.statusDotLive} />
                            <Text style={styles.statusStripText}>AI Engine Active</Text>
                        </View>
                        <Pill tone="cyan" size="xs">Realtime</Pill>
                    </View>
                    <View style={styles.statusMiniRow}>
                        <StatusMini label="Pipeline" value="Active" color={theme.colors.accent} />
                        <StatusMini label="GPS" value={gpsLabel} color={gpsColor} />
                        <StatusMini label={sensorSubLabel} value={sensorLabel} color={sensorColor} />
                    </View>
                </View>

                <View style={styles.mapCard}>
                    <View style={styles.mapDots} />
                    <View style={styles.mapTopRow}>
                        <View style={styles.mapLocationChip}>
                            <MapPin size={11} color={theme.colors.accent} />
                            <Text style={styles.mapLocationText}>Your Area</Text>
                        </View>
                        <TouchableOpacity style={styles.mapNavigateButton} onPress={() => router.push('/driving')}>
                            <Text style={styles.mapNavigateText}>Navigate</Text>
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity style={styles.mapOpenLink} onPress={() => router.push('/map')}>
                        <Route size={13} color={theme.colors.accentIndigo} />
                        <Text style={styles.mapOpenLinkText}>Open Route Map</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.quickGrid}>
                    <TouchableOpacity style={[styles.quickTile, styles.quickTileCyan]} onPress={() => router.push('/driving')} activeOpacity={0.9}>
                        <Car size={22} color={theme.colors.accent} strokeWidth={1.6} />
                        <Text style={styles.quickTileTitle}>Start Driving</Text>
                        <Text style={styles.quickTileSubtitle}>Begin AI detection</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.quickTile, styles.quickTileIndigo]} onPress={() => router.push('/map')} activeOpacity={0.9}>
                        <Route size={22} color={theme.colors.accentIndigo} strokeWidth={1.6} />
                        <Text style={styles.quickTileTitle}>Plan Route</Text>
                        <Text style={styles.quickTileSubtitle}>Find safest path</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Today&apos;s Summary</Text>
                </View>
                <View style={styles.summaryCard}>
                    <SummaryStat label="Samples" value={String(todayStats.samples)} color={theme.colors.text} />
                    <SummaryStat label="Potholes" value={String(todayStats.potholes)} color={theme.colors.danger} />
                    <SummaryStat label="Bumps" value={String(todayStats.bumps)} color={theme.colors.accentWarm} />
                </View>

                <View style={styles.sectionHeader}>
                    <View style={styles.chartHeaderRow}>
                        <Text style={styles.sectionTitle}>Weekly Detections</Text>
                        <View style={styles.legendRow}>
                            <LegendDot color={theme.colors.danger} label="Potholes" />
                            <LegendDot color={theme.colors.accentWarm} label="Bumps" />
                        </View>
                    </View>
                </View>
                <View style={styles.chartCard}>
                    <GroupedBarChart data={weeklyChart} />
                </View>

                <View style={styles.sectionHeader}>
                    <View style={styles.chartHeaderRow}>
                        <Text style={styles.sectionTitle}>Recent Detections</Text>
                        <TouchableOpacity onPress={() => router.push('/logger')}>
                            <Text style={styles.seeAllText}>See all</Text>
                        </TouchableOpacity>
                    </View>
                </View>
                <View style={styles.detectionsCard}>
                    {recentDetections.length === 0 ? (
                        <View style={styles.emptyDetections}>
                            <Activity size={18} color={theme.colors.muted2} />
                            <Text style={styles.emptyDetectionsText}>No detections logged yet. Start driving to collect data.</Text>
                        </View>
                    ) : (
                        recentDetections.map((sample, index) => (
                            <View key={sample.id}>
                                {index > 0 ? <View style={styles.detectionDivider} /> : null}
                                <View style={styles.detectionRow}>
                                    <View
                                        style={[
                                            styles.detectionBar,
                                            { backgroundColor: sample.label === 'POTHOLE' ? theme.colors.danger : theme.colors.accentWarm },
                                        ]}
                                    />
                                    <View style={styles.detectionBody}>
                                        <View style={styles.detectionTopRow}>
                                            <Text style={styles.detectionType}>
                                                {sample.label === 'POTHOLE' ? 'Pothole' : 'Speed Bump'}
                                            </Text>
                                            <Pill tone={sample.label === 'POTHOLE' ? 'red' : 'amber'} size="xs">
                                                {sample.source}
                                            </Pill>
                                        </View>
                                        <Text style={styles.detectionMeta}>{formatRelativeTime(sample.timestamp)}</Text>
                                    </View>
                                    <AlertTriangle size={14} color={theme.colors.muted2} />
                                </View>
                            </View>
                        ))
                    )}
                </View>

                <TouchableOpacity style={styles.supportCard} onPress={() => router.push('/support')} activeOpacity={0.9}>
                    <View style={styles.supportCopy}>
                        <Text style={styles.supportTitle}>Need help?</Text>
                        <Text style={styles.supportSubtitle}>FAQ, live chat, and contact support</Text>
                    </View>
                    <Pill tone="indigo" size="xs">Help &amp; Support</Pill>
                </TouchableOpacity>
            </ScrollView>
            <BottomNavBar active="home" />
        </View>
    )
}

function getDisplayName(user: any) {
    const fullName =
        user?.user_metadata?.full_name ||
        user?.user_metadata?.name ||
        user?.identities?.[0]?.identity_data?.full_name ||
        user?.identities?.[0]?.identity_data?.name

    if (typeof fullName === 'string' && fullName.trim()) {
        return fullName.trim().split(/\s+/)[0]
    }

    const email = user?.email || ''
    if (email.includes('@')) {
        return email.split('@')[0]
    }

    return 'Explorer'
}

function getInitials(name: string) {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || '?'
}

function formatDateKicker(date: Date) {
    return date
        .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
        .toUpperCase()
}

function isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatRelativeTime(iso: string) {
    const diffMs = Date.now() - new Date(iso).getTime()
    const minutes = Math.max(0, Math.round(diffMs / 60000))
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.round(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.round(hours / 24)
    return `${days}d ago`
}

function StatusMini({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <View style={styles.statusMiniItem}>
            <Text style={[styles.statusMiniValue, { color }]}>{value}</Text>
            <Text style={styles.statusMiniLabel}>{label}</Text>
        </View>
    )
}

function SummaryStat({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <View style={styles.summaryStat}>
            <Text style={[styles.summaryStatValue, { color }]}>{value}</Text>
            <Text style={styles.summaryStatLabel}>{label}</Text>
        </View>
    )
}

function LegendDot({ color, label }: { color: string; label: string }) {
    return (
        <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={styles.legendLabel}>{label}</Text>
        </View>
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
        paddingHorizontal: 20,
        position: 'relative',
    },
    glowTop: {
        position: 'absolute',
        top: 40,
        left: -80,
        width: 220,
        height: 220,
        borderRadius: 999,
        backgroundColor: 'rgba(129,140,248,0.1)',
    },
    glowBottom: {
        position: 'absolute',
        right: -90,
        bottom: 120,
        width: 220,
        height: 220,
        borderRadius: 999,
        backgroundColor: 'rgba(34,211,238,0.08)',
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 18,
    },
    headerCopy: {
        flex: 1,
    },
    kicker: {
        color: theme.colors.muted2,
        fontFamily: theme.fonts.mono,
        fontSize: 10,
        letterSpacing: 1.4,
    },
    title: {
        color: theme.colors.text,
        fontFamily: theme.fonts.display,
        fontSize: 21,
        marginTop: 6,
        letterSpacing: -0.4,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingTop: 2,
    },
    iconButton: {
        width: 36,
        height: 36,
        borderRadius: 11,
        backgroundColor: theme.colors.panel,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    notifDot: {
        position: 'absolute',
        top: 7,
        right: 7,
        width: 6,
        height: 6,
        borderRadius: 999,
        backgroundColor: theme.colors.danger,
        borderWidth: 1.5,
        borderColor: theme.colors.bg,
    },
    avatarButton: {
        width: 36,
        height: 36,
        borderRadius: 11,
        borderWidth: 1,
        borderColor: 'rgba(34,211,238,0.28)',
        backgroundColor: 'rgba(34,211,238,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarButtonText: {
        fontFamily: theme.fonts.display,
        fontSize: 12,
        color: theme.colors.accent,
    },
    statusStrip: {
        backgroundColor: theme.colors.panel,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.md,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 14,
    },
    statusTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    statusDotRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    statusDotLive: {
        width: 7,
        height: 7,
        borderRadius: 999,
        backgroundColor: theme.colors.success,
    },
    statusStripText: {
        fontFamily: theme.fonts.bodySemiBold,
        fontSize: 12,
        color: theme.colors.success,
    },
    statusMiniRow: {
        flexDirection: 'row',
        marginTop: 12,
    },
    statusMiniItem: {
        flex: 1,
        alignItems: 'center',
    },
    statusMiniValue: {
        fontFamily: theme.fonts.display,
        fontSize: 13,
    },
    statusMiniLabel: {
        fontFamily: theme.fonts.body,
        fontSize: 9,
        color: theme.colors.muted2,
        marginTop: 2,
    },
    mapCard: {
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.panelSoft,
        padding: 14,
        marginBottom: 18,
        overflow: 'hidden',
    },
    mapDots: {
        position: 'absolute',
        top: -20,
        right: -20,
        width: 140,
        height: 140,
        borderRadius: 999,
        backgroundColor: 'rgba(34,211,238,0.06)',
    },
    mapTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    mapLocationChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(7,9,15,0.5)',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    mapLocationText: {
        color: theme.colors.text,
        fontFamily: theme.fonts.body,
        fontSize: 11,
    },
    mapNavigateButton: {
        backgroundColor: theme.colors.accent,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 7,
    },
    mapNavigateText: {
        color: theme.colors.bg,
        fontFamily: theme.fonts.bodyBold,
        fontSize: 11,
    },
    mapOpenLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 14,
    },
    mapOpenLinkText: {
        color: theme.colors.accentIndigo,
        fontFamily: theme.fonts.bodySemiBold,
        fontSize: 12,
    },
    quickGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 22,
    },
    quickTile: {
        flex: 1,
        backgroundColor: theme.colors.panel,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.xl,
        padding: 16,
        borderTopWidth: 2,
        gap: 10,
    },
    quickTileCyan: {
        borderTopColor: theme.colors.accent,
    },
    quickTileIndigo: {
        borderTopColor: theme.colors.accentIndigo,
    },
    quickTileTitle: {
        color: theme.colors.text,
        fontFamily: theme.fonts.display,
        fontSize: 14,
    },
    quickTileSubtitle: {
        color: theme.colors.muted2,
        fontFamily: theme.fonts.body,
        fontSize: 11,
        marginTop: -6,
    },
    sectionHeader: {
        marginBottom: 12,
    },
    sectionTitle: {
        color: theme.colors.muted2,
        fontFamily: theme.fonts.bodySemiBold,
        fontSize: 11,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    chartHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    legendRow: {
        flexDirection: 'row',
        gap: 12,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    legendDot: {
        width: 6,
        height: 6,
        borderRadius: 2,
    },
    legendLabel: {
        color: theme.colors.muted2,
        fontFamily: theme.fonts.body,
        fontSize: 9,
    },
    seeAllText: {
        color: theme.colors.accent,
        fontFamily: theme.fonts.body,
        fontSize: 11,
    },
    summaryCard: {
        flexDirection: 'row',
        backgroundColor: theme.colors.panel,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: theme.colors.border,
        marginBottom: 22,
    },
    summaryStat: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 16,
    },
    summaryStatValue: {
        fontFamily: theme.fonts.display,
        fontSize: 20,
    },
    summaryStatLabel: {
        color: theme.colors.muted2,
        fontFamily: theme.fonts.body,
        fontSize: 9,
        marginTop: 3,
    },
    chartCard: {
        backgroundColor: theme.colors.panel,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: 16,
        marginBottom: 22,
    },
    detectionsCard: {
        backgroundColor: theme.colors.panel,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: theme.colors.border,
        overflow: 'hidden',
        marginBottom: 22,
    },
    detectionDivider: {
        height: 1,
        backgroundColor: theme.colors.border,
    },
    detectionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
    },
    detectionBar: {
        width: 3,
        height: 32,
        borderRadius: 2,
    },
    detectionBody: {
        flex: 1,
    },
    detectionTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 3,
    },
    detectionType: {
        color: theme.colors.text,
        fontFamily: theme.fonts.bodySemiBold,
        fontSize: 13,
    },
    detectionMeta: {
        color: theme.colors.muted2,
        fontFamily: theme.fonts.body,
        fontSize: 11,
    },
    emptyDetections: {
        alignItems: 'center',
        gap: 8,
        paddingVertical: 24,
        paddingHorizontal: 20,
    },
    emptyDetectionsText: {
        color: theme.colors.muted,
        fontFamily: theme.fonts.body,
        fontSize: 12,
        textAlign: 'center',
    },
    supportCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.colors.panel,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: 16,
        marginBottom: 12,
    },
    supportCopy: {
        flex: 1,
    },
    supportTitle: {
        color: theme.colors.text,
        fontFamily: theme.fonts.bodySemiBold,
        fontSize: 14,
    },
    supportSubtitle: {
        color: theme.colors.muted2,
        fontFamily: theme.fonts.body,
        fontSize: 11,
        marginTop: 2,
    },
})
