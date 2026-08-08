import { useCallback, useMemo, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TrendingUp, TrendingDown, MapPin } from 'lucide-react-native'
import { theme } from '../src/theme'
import { getLoggedSamples, LoggedSample } from '../src/services/data-logger.service'
import { BottomNavBar } from '../components/bottom-nav-bar'
import { GroupedBarChart, BarSeriesPoint } from '../components/grouped-bar-chart'

type Period = '7D' | '30D' | '3M'
const PERIODS: Period[] = ['7D', '30D', '3M']
const PERIOD_DAYS: Record<Period, number> = { '7D': 7, '30D': 30, '3M': 90 }

export default function AnalyticsScreen() {
    const insets = useSafeAreaInsets()
    const [period, setPeriod] = useState<Period>('7D')
    const [samples, setSamples] = useState<LoggedSample[]>([])

    useFocusEffect(
        useCallback(() => {
            void getLoggedSamples().then(setSamples)
        }, [])
    )

    const days = PERIOD_DAYS[period]

    const { currentSamples, previousSamples } = useMemo(() => {
        const now = Date.now()
        const currentStart = now - days * 24 * 60 * 60 * 1000
        const previousStart = now - days * 2 * 24 * 60 * 60 * 1000

        return {
            currentSamples: samples.filter((s) => new Date(s.timestamp).getTime() >= currentStart),
            previousSamples: samples.filter((s) => {
                const t = new Date(s.timestamp).getTime()
                return t >= previousStart && t < currentStart
            }),
        }
    }, [samples, days])

    const potholes = currentSamples.filter((s) => s.label === 'POTHOLE').length
    const bumps = currentSamples.filter((s) => s.label === 'SPEED_BUMP').length
    const total = currentSamples.length
    const previousTotal = previousSamples.length
    const trendPct = previousTotal === 0 ? (total > 0 ? 100 : 0) : Math.round(((total - previousTotal) / previousTotal) * 100)
    const sessions = useMemo(() => countSessions(currentSamples), [currentSamples])

    const chart = useMemo<BarSeriesPoint[]>(() => {
        const bucketCount = period === '7D' ? 7 : period === '30D' ? 10 : 12
        const bucketDays = Math.max(1, Math.round(days / bucketCount))
        const buckets: { start: number; end: number; potholes: number; bumps: number }[] = []
        const now = Date.now()

        for (let i = bucketCount - 1; i >= 0; i -= 1) {
            const end = now - i * bucketDays * 24 * 60 * 60 * 1000
            const start = end - bucketDays * 24 * 60 * 60 * 1000
            buckets.push({ start, end, potholes: 0, bumps: 0 })
        }

        currentSamples.forEach((sample) => {
            const t = new Date(sample.timestamp).getTime()
            const bucket = buckets.find((b) => t >= b.start && t < b.end)
            if (!bucket) return
            if (sample.label === 'POTHOLE') bucket.potholes += 1
            if (sample.label === 'SPEED_BUMP') bucket.bumps += 1
        })

        return buckets.map((b, index) => ({
            label: period === '7D' ? new Date(b.end).toLocaleDateString('en-US', { weekday: 'narrow' }) : `${index + 1}`,
            values: [
                { value: b.potholes, color: theme.colors.danger },
                { value: b.bumps, color: theme.colors.accentWarm },
            ],
        }))
    }, [currentSamples, period, days])

    const topLocations = useMemo(() => {
        const buckets = new Map<string, { lat: number; lng: number; count: number }>()
        currentSamples.forEach((sample) => {
            if (sample.label === 'NORMAL' || typeof sample.latitude !== 'number' || typeof sample.longitude !== 'number') return
            const key = `${sample.latitude.toFixed(3)},${sample.longitude.toFixed(3)}`
            const existing = buckets.get(key)
            if (existing) {
                existing.count += 1
            } else {
                buckets.set(key, { lat: sample.latitude, lng: sample.longitude, count: 1 })
            }
        })

        return Array.from(buckets.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
    }, [currentSamples])

    const maxLocationCount = Math.max(1, ...topLocations.map((l) => l.count))

    return (
        <View style={styles.screen}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: 128 }]}
            >
                <View style={styles.headerRow}>
                    <Text style={styles.title}>Analytics</Text>
                    <View style={styles.periodRow}>
                        {PERIODS.map((p) => (
                            <TouchableOpacity
                                key={p}
                                style={[styles.periodChip, p === period && styles.periodChipActive]}
                                onPress={() => setPeriod(p)}
                            >
                                <Text style={[styles.periodChipText, p === period && styles.periodChipTextActive]}>{p}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.heroCard}>
                    <Text style={styles.heroLabel}>Total Detections</Text>
                    <Text style={styles.heroValue}>{total.toLocaleString()}</Text>
                    <View style={styles.trendRow}>
                        {trendPct >= 0 ? (
                            <TrendingUp size={13} color={theme.colors.success} />
                        ) : (
                            <TrendingDown size={13} color={theme.colors.danger} />
                        )}
                        <Text style={[styles.trendText, { color: trendPct >= 0 ? theme.colors.success : theme.colors.danger }]}>
                            {trendPct >= 0 ? '+' : ''}{trendPct}% vs previous {period}
                        </Text>
                    </View>
                </View>

                <View style={styles.kpiRow}>
                    <KpiTile label="Potholes" value={String(potholes)} color={theme.colors.danger} />
                    <KpiTile label="Speed Bumps" value={String(bumps)} color={theme.colors.accentWarm} />
                    <KpiTile label="Sessions" value={String(sessions)} color={theme.colors.accentIndigo} />
                </View>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Detections Over Time</Text>
                </View>
                <View style={styles.chartCard}>
                    <GroupedBarChart data={chart} />
                </View>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Top Locations</Text>
                </View>
                <View style={styles.locationsCard}>
                    {topLocations.length === 0 ? (
                        <View style={styles.emptyState}>
                            <MapPin size={18} color={theme.colors.muted2} />
                            <Text style={styles.emptyStateText}>No GPS-tagged detections in this period yet.</Text>
                        </View>
                    ) : (
                        topLocations.map((loc, index) => (
                            <View key={`${loc.lat}-${loc.lng}`}>
                                {index > 0 ? <View style={styles.locationDivider} /> : null}
                                <View style={styles.locationRow}>
                                    <View style={styles.locationTopRow}>
                                        <Text style={styles.locationLabel}>{loc.lat.toFixed(3)}, {loc.lng.toFixed(3)}</Text>
                                        <Text style={styles.locationCount}>{loc.count}</Text>
                                    </View>
                                    <View style={styles.locationBarTrack}>
                                        <View style={[styles.locationBarFill, { width: `${(loc.count / maxLocationCount) * 100}%` }]} />
                                    </View>
                                </View>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>
            <BottomNavBar active="analytics" />
        </View>
    )
}

function countSessions(samples: LoggedSample[]) {
    if (samples.length === 0) return 0
    const sorted = [...samples].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    let count = 1
    let lastTs = new Date(sorted[0].timestamp).getTime()
    let lastSource = sorted[0].source

    for (let i = 1; i < sorted.length; i += 1) {
        const ts = new Date(sorted[i].timestamp).getTime()
        if (sorted[i].source !== lastSource || ts - lastTs > 2 * 60 * 1000) {
            count += 1
        }
        lastTs = ts
        lastSource = sorted[i].source
    }

    return count
}

function KpiTile({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <View style={styles.kpiTile}>
            <Text style={[styles.kpiValue, { color }]}>{value}</Text>
            <Text style={styles.kpiLabel}>{label}</Text>
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
        paddingHorizontal: 18,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 18,
    },
    title: {
        color: theme.colors.text,
        fontFamily: theme.fonts.display,
        fontSize: 22,
        letterSpacing: -0.4,
    },
    periodRow: {
        flexDirection: 'row',
        gap: 6,
    },
    periodChip: {
        paddingHorizontal: 11,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    periodChipActive: {
        backgroundColor: 'rgba(34,211,238,0.08)',
        borderColor: 'rgba(34,211,238,0.32)',
    },
    periodChipText: {
        color: theme.colors.muted2,
        fontFamily: theme.fonts.bodySemiBold,
        fontSize: 11,
    },
    periodChipTextActive: {
        color: theme.colors.accent,
    },
    heroCard: {
        backgroundColor: theme.colors.panel,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.xl,
        padding: 20,
        marginBottom: 14,
    },
    heroLabel: {
        color: theme.colors.muted2,
        fontFamily: theme.fonts.bodySemiBold,
        fontSize: 11,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    heroValue: {
        color: theme.colors.text,
        fontFamily: theme.fonts.display,
        fontSize: 44,
        letterSpacing: -1,
    },
    trendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
    },
    trendText: {
        fontFamily: theme.fonts.bodySemiBold,
        fontSize: 12,
    },
    kpiRow: {
        flexDirection: 'row',
        backgroundColor: theme.colors.panel,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.xl,
        marginBottom: 22,
    },
    kpiTile: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 16,
    },
    kpiValue: {
        fontFamily: theme.fonts.display,
        fontSize: 18,
    },
    kpiLabel: {
        color: theme.colors.muted2,
        fontFamily: theme.fonts.body,
        fontSize: 9,
        marginTop: 3,
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
    chartCard: {
        backgroundColor: theme.colors.panel,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.xl,
        padding: 16,
        marginBottom: 22,
    },
    locationsCard: {
        backgroundColor: theme.colors.panel,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.xl,
        overflow: 'hidden',
    },
    locationDivider: {
        height: 1,
        backgroundColor: theme.colors.border,
    },
    locationRow: {
        padding: 14,
    },
    locationTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    locationLabel: {
        color: theme.colors.text,
        fontFamily: theme.fonts.mono,
        fontSize: 12,
    },
    locationCount: {
        color: theme.colors.danger,
        fontFamily: theme.fonts.bodyBold,
        fontSize: 13,
    },
    locationBarTrack: {
        height: 3,
        borderRadius: 2,
        backgroundColor: theme.colors.border,
    },
    locationBarFill: {
        height: 3,
        borderRadius: 2,
        backgroundColor: theme.colors.danger,
    },
    emptyState: {
        alignItems: 'center',
        gap: 8,
        paddingVertical: 24,
        paddingHorizontal: 20,
    },
    emptyStateText: {
        color: theme.colors.muted,
        fontFamily: theme.fonts.body,
        fontSize: 12,
        textAlign: 'center',
    },
})
