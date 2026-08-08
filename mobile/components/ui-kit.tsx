import type { ReactNode } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { theme } from '../src/theme'

export type PillTone = 'cyan' | 'indigo' | 'amber' | 'red' | 'green' | 'dim'

const PILL_TONES: Record<PillTone, { bg: string; border: string; fg: string }> = {
    cyan: { bg: 'rgba(34,211,238,0.1)', border: 'rgba(34,211,238,0.22)', fg: theme.colors.accent },
    indigo: { bg: 'rgba(129,140,248,0.1)', border: 'rgba(129,140,248,0.22)', fg: theme.colors.accentIndigo },
    amber: { bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.22)', fg: theme.colors.accentWarm },
    red: { bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.22)', fg: theme.colors.danger },
    green: { bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.22)', fg: theme.colors.success },
    dim: { bg: 'rgba(237,242,255,0.06)', border: 'rgba(237,242,255,0.1)', fg: theme.colors.muted },
}

export function Pill({ children, tone = 'cyan', size = 'sm' }: { children: ReactNode; tone?: PillTone; size?: 'sm' | 'xs' }) {
    const c = PILL_TONES[tone]
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

export function Card({ children, style }: { children: ReactNode; style?: any }) {
    return <View style={[styles.card, style]}>{children}</View>
}

const styles = StyleSheet.create({
    pill: {
        borderRadius: 999,
        borderWidth: 1,
        alignSelf: 'flex-start',
    },
    pillText: {
        fontFamily: theme.fonts.bodySemiBold,
        letterSpacing: 0.3,
    },
    divider: {
        height: 1,
        backgroundColor: theme.colors.border,
    },
    card: {
        backgroundColor: theme.colors.panel,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
})
