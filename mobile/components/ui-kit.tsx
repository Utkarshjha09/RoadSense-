/**
 * RoadSense UI kit — mobile
 * ---------------------------------------------------------------
 * Mirrors `web/src/components/ui.tsx` one-for-one so a screen built
 * here and a screen built on the web share the same vocabulary:
 * Card, Pill, SectionHeader, StatTile, StatusStrip, Button,
 * IconButton, EmptyState.
 */

import type { ReactNode } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, type ViewStyle, type StyleProp } from 'react-native'
import { theme, tones, type Tone } from '../src/theme'

/**
 * Legacy tone names used by existing screens, mapped onto the shared
 * semantic tones. Both spellings work, so screens can migrate lazily.
 */
export type PillTone = Tone | 'cyan' | 'indigo' | 'amber' | 'red' | 'green' | 'dim'

const TONE_ALIAS: Record<string, Tone> = {
    cyan: 'primary',
    indigo: 'secondary',
    amber: 'warn',
    red: 'danger',
    green: 'success',
    dim: 'neutral',
}

function resolveTone(tone: PillTone): Tone {
    return TONE_ALIAS[tone as string] ?? (tone as Tone)
}

/* -------------------------------------------------------------- */

export function Pill({
    children,
    tone = 'primary',
    size = 'sm',
}: {
    children: ReactNode
    tone?: PillTone
    size?: 'sm' | 'xs'
}) {
    const c = tones[resolveTone(tone)]

    return (
        <View
            style={[
                styles.pill,
                {
                    backgroundColor: c.bg,
                    borderColor: c.border,
                    paddingHorizontal: size === 'xs' ? 8 : 10,
                    paddingVertical: size === 'xs' ? 2 : 4,
                },
            ]}
        >
            <Text style={[styles.pillText, { color: c.fg, fontSize: size === 'xs' ? 9 : 10.5 }]}>{children}</Text>
        </View>
    )
}

export function Divider() {
    return <View style={styles.divider} />
}

export function Card({
    children,
    style,
    soft = false,
}: {
    children: ReactNode
    style?: StyleProp<ViewStyle>
    soft?: boolean
}) {
    return <View style={[soft ? styles.cardSoft : styles.card, style]}>{children}</View>
}

/** Section title with optional kicker and a trailing action. */
export function SectionHeader({
    title,
    kicker,
    action,
}: {
    title: string
    kicker?: string
    action?: ReactNode
}) {
    return (
        <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderCopy}>
                {kicker ? <Text style={styles.kicker}>{kicker.toUpperCase()}</Text> : null}
                <Text style={styles.sectionTitle}>{title}</Text>
            </View>
            {action ? <View>{action}</View> : null}
        </View>
    )
}

/** The primary metric card — icon, label, big number, optional hint. */
export function StatTile({
    icon,
    label,
    value,
    tone = 'primary',
    hint,
    style,
}: {
    icon?: ReactNode
    label: string
    value: string | number
    tone?: PillTone
    hint?: string
    style?: StyleProp<ViewStyle>
}) {
    const c = tones[resolveTone(tone)]

    return (
        <Card style={[styles.statTile, style]}>
            <View style={styles.statTileRow}>
                <View style={styles.statTileCopy}>
                    <Text style={styles.kicker}>{label.toUpperCase()}</Text>
                    <Text style={[styles.metric, { color: c.fg }]}>{value}</Text>
                    {hint ? <Text style={styles.statTileHint}>{hint}</Text> : null}
                </View>
                {icon ? (
                    <View style={[styles.statTileIcon, { backgroundColor: c.bg, borderColor: c.border }]}>{icon}</View>
                ) : null}
            </View>
        </Card>
    )
}

/** Compact horizontal status readout, as on the home screen. */
export function StatusStrip({
    label,
    badge,
    items,
}: {
    label: string
    badge?: string
    items: { label: string; value: string; tone?: PillTone }[]
}) {
    return (
        <Card soft style={styles.statusStrip}>
            <View style={styles.statusTopRow}>
                <View style={styles.statusDotRow}>
                    <View style={styles.statusDot} />
                    <Text style={styles.statusLabel}>{label}</Text>
                </View>
                {badge ? (
                    <Pill tone="primary" size="xs">
                        {badge}
                    </Pill>
                ) : null}
            </View>
            <View style={styles.statusItems}>
                {items.map((item) => (
                    <View key={item.label} style={styles.statusItem}>
                        <Text style={[styles.statusValue, { color: tones[resolveTone(item.tone ?? 'neutral')].fg }]}>
                            {item.value}
                        </Text>
                        <Text style={styles.kicker}>{item.label.toUpperCase()}</Text>
                    </View>
                ))}
            </View>
        </Card>
    )
}

/* -------------------------------------------------------------- */

export function Button({
    children,
    onPress,
    variant = 'primary',
    icon,
    disabled = false,
    style,
}: {
    children: ReactNode
    onPress?: () => void
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    icon?: ReactNode
    disabled?: boolean
    style?: StyleProp<ViewStyle>
}) {
    const variantStyle =
        variant === 'primary'
            ? styles.buttonPrimary
            : variant === 'danger'
                ? styles.buttonDanger
                : variant === 'ghost'
                    ? styles.buttonGhost
                    : styles.buttonSecondary

    const labelColor =
        variant === 'primary'
            ? theme.colors.primaryInk
            : variant === 'danger'
                ? theme.colors.danger
                : theme.colors.text

    return (
        <TouchableOpacity
            style={[styles.buttonBase, variantStyle, disabled && styles.buttonDisabled, style]}
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.85}
        >
            {icon}
            <Text style={[styles.buttonLabel, { color: labelColor }]}>{children}</Text>
        </TouchableOpacity>
    )
}

export function IconButton({
    icon,
    onPress,
    style,
}: {
    icon: ReactNode
    onPress?: () => void
    style?: StyleProp<ViewStyle>
}) {
    return (
        <TouchableOpacity style={[styles.iconButton, style]} onPress={onPress} activeOpacity={0.75}>
            {icon}
        </TouchableOpacity>
    )
}

export function EmptyState({
    icon,
    title,
    description,
    action,
}: {
    icon?: ReactNode
    title: string
    description?: string
    action?: ReactNode
}) {
    return (
        <View style={styles.emptyState}>
            {icon ? <View style={styles.emptyIcon}>{icon}</View> : null}
            <Text style={styles.emptyTitle}>{title}</Text>
            {description ? <Text style={styles.emptyDescription}>{description}</Text> : null}
            {action}
        </View>
    )
}

/* -------------------------------------------------------------- */

const styles = StyleSheet.create({
    pill: {
        borderRadius: theme.radius.pill,
        borderWidth: 1,
        alignSelf: 'flex-start',
    },
    pillText: {
        fontFamily: theme.fonts.bodySemiBold,
        letterSpacing: 0.3,
    },
    divider: {
        height: 1,
        backgroundColor: theme.colors.line,
    },
    card: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: theme.colors.line,
    },
    cardSoft: {
        backgroundColor: theme.colors.surface2,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.line,
    },

    kicker: {
        ...theme.type.kicker,
        color: theme.colors.textFaint,
    },

    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: theme.space.md,
        marginBottom: theme.space.md,
    },
    sectionHeaderCopy: {
        flex: 1,
        gap: 4,
    },
    sectionTitle: {
        ...theme.type.heading,
        color: theme.colors.text,
    },

    statTile: {
        padding: theme.space.lg,
        flex: 1,
    },
    statTileRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: theme.space.md,
    },
    statTileCopy: {
        flex: 1,
        gap: theme.space.sm,
    },
    statTileHint: {
        ...theme.type.micro,
        color: theme.colors.textFaint,
    },
    statTileIcon: {
        padding: 9,
        borderRadius: theme.radius.md,
        borderWidth: 1,
    },
    metric: {
        ...theme.type.metric,
    },

    statusStrip: {
        paddingHorizontal: theme.space.lg,
        paddingVertical: theme.space.md,
        gap: theme.space.md,
    },
    statusTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    statusDotRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.sm,
    },
    statusDot: {
        width: 7,
        height: 7,
        borderRadius: 999,
        backgroundColor: theme.colors.success,
    },
    statusLabel: {
        ...theme.type.smallStrong,
        color: theme.colors.text,
    },
    statusItems: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.space.xl,
    },
    statusItem: {
        gap: 3,
    },
    statusValue: {
        ...theme.type.smallStrong,
    },

    buttonBase: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.space.sm,
        borderRadius: theme.radius.md,
        paddingHorizontal: theme.space.lg,
        paddingVertical: 11,
        borderWidth: 1,
    },
    buttonPrimary: {
        backgroundColor: theme.colors.primary,
        borderColor: 'transparent',
    },
    buttonSecondary: {
        backgroundColor: theme.colors.surface2,
        borderColor: theme.colors.lineStrong,
    },
    buttonGhost: {
        backgroundColor: 'transparent',
        borderColor: 'transparent',
    },
    buttonDanger: {
        backgroundColor: tones.danger.bg,
        borderColor: tones.danger.border,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonLabel: {
        fontFamily: theme.fonts.bodySemiBold,
        fontSize: 15,
    },

    iconButton: {
        height: 38,
        width: 38,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.line,
        backgroundColor: theme.colors.surface2,
        alignItems: 'center',
        justifyContent: 'center',
    },

    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.space.md,
        paddingVertical: theme.space['3xl'],
        paddingHorizontal: theme.space.xl,
    },
    emptyIcon: {
        padding: theme.space.md,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: theme.colors.line,
        backgroundColor: 'rgba(233,240,255,0.05)',
    },
    emptyTitle: {
        ...theme.type.heading,
        color: theme.colors.text,
        textAlign: 'center',
    },
    emptyDescription: {
        ...theme.type.small,
        color: theme.colors.textMuted,
        textAlign: 'center',
    },
})
