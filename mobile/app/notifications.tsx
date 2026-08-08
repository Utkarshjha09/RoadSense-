import { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft, AlertTriangle, Activity, Bell } from 'lucide-react-native'
import { theme } from '../src/theme'
import { getLoggedSamples, LoggedSample } from '../src/services/data-logger.service'
import { getPendingAnomalyCsvUploadCount } from '../src/services/supabase.service'

type FeedItem = {
    id: string
    title: string
    body: string
    timestamp: string
    tone: 'red' | 'amber'
}

export default function NotificationsScreen() {
    const insets = useSafeAreaInsets()
    const [samples, setSamples] = useState<LoggedSample[]>([])
    const [pendingUploads, setPendingUploads] = useState(0)
    const [readIds, setReadIds] = useState<Set<string>>(new Set())

    useEffect(() => {
        void getLoggedSamples().then(setSamples)
        void getPendingAnomalyCsvUploadCount().then(setPendingUploads)
    }, [])

    const items = useMemo<FeedItem[]>(() => {
        const detections = samples
            .filter((s) => s.label === 'POTHOLE' || s.label === 'SPEED_BUMP')
            .slice(-15)
            .reverse()
            .map((sample) => ({
                id: sample.id,
                title: sample.label === 'POTHOLE' ? 'Pothole Detected' : 'Speed Bump Detected',
                body:
                    typeof sample.latitude === 'number' && typeof sample.longitude === 'number'
                        ? `Logged at ${sample.latitude.toFixed(4)}, ${sample.longitude.toFixed(4)} (${sample.source})`
                        : `Logged during a ${sample.source} session`,
                timestamp: sample.timestamp,
                tone: (sample.label === 'POTHOLE' ? 'red' : 'amber') as 'red' | 'amber',
            }))

        return detections
    }, [samples])

    function markAllRead() {
        setReadIds(new Set(items.map((item) => item.id)))
    }

    return (
        <View style={styles.screen}>
            <View style={[styles.headerRow, { paddingTop: insets.top + 8 }]}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                        <ChevronLeft size={18} color={theme.colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Notifications</Text>
                </View>
                {items.length > 0 ? (
                    <TouchableOpacity onPress={markAllRead}>
                        <Text style={styles.markReadText}>Mark all read</Text>
                    </TouchableOpacity>
                ) : null}
            </View>

            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                {pendingUploads > 0 ? (
                    <View style={styles.pendingBanner}>
                        <Text style={styles.pendingBannerText}>
                            {pendingUploads} anomaly CSV file{pendingUploads === 1 ? '' : 's'} queued for cloud upload.
                        </Text>
                    </View>
                ) : null}

                {items.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Bell size={22} color={theme.colors.muted2} />
                        <Text style={styles.emptyStateText}>No notifications yet. Detections you log will show up here.</Text>
                    </View>
                ) : (
                    <View style={styles.listCard}>
                        {items.map((item, index) => {
                            const unread = !readIds.has(item.id)
                            return (
                                <View key={item.id}>
                                    {index > 0 ? <View style={styles.divider} /> : null}
                                    <View style={[styles.row, unread && styles.rowUnread]}>
                                        <View
                                            style={[
                                                styles.iconWrap,
                                                { backgroundColor: item.tone === 'red' ? 'rgba(248,113,113,0.12)' : 'rgba(251,191,36,0.12)' },
                                            ]}
                                        >
                                            {item.tone === 'red' ? (
                                                <AlertTriangle size={14} color={theme.colors.danger} />
                                            ) : (
                                                <Activity size={14} color={theme.colors.accentWarm} />
                                            )}
                                        </View>
                                        <View style={styles.rowBody}>
                                            <View style={styles.rowTopLine}>
                                                <Text style={[styles.rowTitle, unread && styles.rowTitleUnread]}>{item.title}</Text>
                                                {unread ? <View style={styles.unreadDot} /> : null}
                                            </View>
                                            <Text style={styles.rowSub}>{item.body}</Text>
                                            <Text style={styles.rowTime}>{formatRelativeTime(item.timestamp)}</Text>
                                        </View>
                                    </View>
                                </View>
                            )
                        })}
                    </View>
                )}
            </ScrollView>
        </View>
    )
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

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: theme.colors.bg,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 11,
        backgroundColor: theme.colors.panel,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        color: theme.colors.text,
        fontFamily: theme.fonts.display,
        fontSize: 19,
        letterSpacing: -0.3,
    },
    markReadText: {
        color: theme.colors.accent,
        fontFamily: theme.fonts.body,
        fontSize: 12,
    },
    container: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    pendingBanner: {
        backgroundColor: 'rgba(129,140,248,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(129,140,248,0.2)',
        borderRadius: theme.radius.md,
        padding: 12,
        marginBottom: 14,
    },
    pendingBannerText: {
        color: theme.colors.accentIndigo,
        fontFamily: theme.fonts.body,
        fontSize: 12,
    },
    listCard: {
        backgroundColor: theme.colors.panel,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: theme.colors.border,
        overflow: 'hidden',
    },
    divider: {
        height: 1,
        backgroundColor: theme.colors.border,
    },
    row: {
        flexDirection: 'row',
        gap: 14,
        padding: 14,
    },
    rowUnread: {
        backgroundColor: 'rgba(34,211,238,0.025)',
    },
    iconWrap: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowBody: {
        flex: 1,
    },
    rowTopLine: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 3,
    },
    rowTitle: {
        color: theme.colors.muted,
        fontFamily: theme.fonts.body,
        fontSize: 13,
    },
    rowTitleUnread: {
        color: theme.colors.text,
        fontFamily: theme.fonts.bodyBold,
    },
    unreadDot: {
        width: 6,
        height: 6,
        borderRadius: 999,
        backgroundColor: theme.colors.accent,
        marginTop: 4,
        marginLeft: 8,
    },
    rowSub: {
        color: theme.colors.muted2,
        fontFamily: theme.fonts.body,
        fontSize: 11,
        lineHeight: 16,
        marginBottom: 4,
    },
    rowTime: {
        color: theme.colors.muted2,
        fontFamily: theme.fonts.mono,
        fontSize: 9,
    },
    emptyState: {
        alignItems: 'center',
        gap: 10,
        paddingVertical: 60,
        paddingHorizontal: 30,
    },
    emptyStateText: {
        color: theme.colors.muted,
        fontFamily: theme.fonts.body,
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 19,
    },
})
