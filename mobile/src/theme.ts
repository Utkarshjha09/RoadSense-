/**
 * RoadSense Design System v2
 * ---------------------------------------------------------------
 * Single source of truth for the mobile app. The web app mirrors
 * these exact values in `web/src/index.css` (`--rs-*` variables)
 * and `web/tailwind.config.js`. Keep the three in sync.
 */

/* -------------------------------------------------------------- */
/* Palette                                                         */
/* -------------------------------------------------------------- */

export const palette = {
    /* Layered dark surfaces — each step is a distinct elevation. */
    canvas: '#070A10',
    surface: '#0E1219',
    surface2: '#141924',
    surface3: '#1A2130',

    /* Hairlines. Alpha-based so they sit correctly on any surface. */
    line: 'rgba(233,240,255,0.075)',
    lineStrong: 'rgba(233,240,255,0.14)',

    /* Type. */
    text: '#E9F0FF',
    textMuted: 'rgba(233,240,255,0.60)',
    textFaint: 'rgba(233,240,255,0.32)',

    /* Semantic accents. */
    primary: '#22D3EE',
    primaryInk: '#070A10',
    primarySoft: 'rgba(34,211,238,0.12)',
    primaryEdge: 'rgba(34,211,238,0.30)',

    secondary: '#818CF8',
    secondarySoft: 'rgba(129,140,248,0.12)',
    secondaryEdge: 'rgba(129,140,248,0.30)',

    warn: '#FBBF24',
    warnSoft: 'rgba(251,191,36,0.12)',
    warnEdge: 'rgba(251,191,36,0.30)',

    danger: '#FB7185',
    dangerSoft: 'rgba(251,113,133,0.12)',
    dangerEdge: 'rgba(251,113,133,0.30)',

    success: '#34D399',
    successSoft: 'rgba(52,211,153,0.12)',
    successEdge: 'rgba(52,211,153,0.30)',
} as const

/* -------------------------------------------------------------- */
/* Scales                                                          */
/* -------------------------------------------------------------- */

/** 4pt base grid. Use these instead of magic numbers. */
export const space = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
} as const

export const radius = {
    sm: 10,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 28,
    pill: 999,
} as const

export const fonts = {
    display: 'Exo2_800ExtraBold',
    displayBold: 'Exo2_700Bold',
    displayBlack: 'Exo2_900Black',
    body: 'DMSans_400Regular',
    bodyMedium: 'DMSans_500Medium',
    bodySemiBold: 'DMSans_600SemiBold',
    bodyBold: 'DMSans_700Bold',
    mono: 'JetBrainsMono_400Regular',
    monoMedium: 'JetBrainsMono_500Medium',
} as const

/** Shared type ramp. `web/src/index.css` mirrors these as rem values. */
export const type = {
    display: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.4 },
    title: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
    heading: { fontFamily: fonts.displayBold, fontSize: 17, lineHeight: 22 },
    body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21 },
    bodyStrong: { fontFamily: fonts.bodySemiBold, fontSize: 15, lineHeight: 21 },
    small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
    smallStrong: { fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 18 },
    micro: { fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 15 },
    /** Uppercase tracked label used above section titles and stats. */
    kicker: { fontFamily: fonts.mono, fontSize: 10, lineHeight: 14, letterSpacing: 1.4 },
    /** Tabular figures for metrics. */
    metric: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, letterSpacing: -0.5 },
} as const

export const shadow = {
    card: {
        shadowColor: '#000',
        shadowOpacity: 0.34,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 12 },
        elevation: 6,
    },
    raised: {
        shadowColor: '#000',
        shadowOpacity: 0.42,
        shadowRadius: 30,
        shadowOffset: { width: 0, height: 18 },
        elevation: 12,
    },
} as const

/* -------------------------------------------------------------- */
/* Tones — one accent family, resolved for any component           */
/* -------------------------------------------------------------- */

export type Tone = 'primary' | 'secondary' | 'warn' | 'danger' | 'success' | 'neutral'

export const tones: Record<Tone, { fg: string; bg: string; border: string }> = {
    primary: { fg: palette.primary, bg: palette.primarySoft, border: palette.primaryEdge },
    secondary: { fg: palette.secondary, bg: palette.secondarySoft, border: palette.secondaryEdge },
    warn: { fg: palette.warn, bg: palette.warnSoft, border: palette.warnEdge },
    danger: { fg: palette.danger, bg: palette.dangerSoft, border: palette.dangerEdge },
    success: { fg: palette.success, bg: palette.successSoft, border: palette.successEdge },
    neutral: { fg: palette.textMuted, bg: 'rgba(233,240,255,0.06)', border: palette.line },
}

/* -------------------------------------------------------------- */
/* Public theme object                                             */
/* -------------------------------------------------------------- */

export const theme = {
    colors: {
        /* v2 names */
        canvas: palette.canvas,
        surface: palette.surface,
        surface2: palette.surface2,
        surface3: palette.surface3,
        line: palette.line,
        lineStrong: palette.lineStrong,
        text: palette.text,
        textMuted: palette.textMuted,
        textFaint: palette.textFaint,
        primary: palette.primary,
        primaryInk: palette.primaryInk,
        secondary: palette.secondary,
        warn: palette.warn,
        danger: palette.danger,
        success: palette.success,

        /* v1 aliases — kept so existing screens keep compiling. */
        bg: palette.canvas,
        bgElevated: palette.surface2,
        panel: palette.surface,
        panelSoft: palette.surface2,
        border: palette.line,
        muted: palette.textMuted,
        muted2: palette.textFaint,
        accent: palette.primary,
        accentIndigo: palette.secondary,
        accentWarm: palette.warn,
    },
    radius: {
        ...radius,
        /* v1 alias */
        xl: radius.xl,
        lg: radius.lg,
        md: radius.md,
        sm: radius.sm,
    },
    space,
    type,
    fonts,
    shadow,
    tones,
} as const
