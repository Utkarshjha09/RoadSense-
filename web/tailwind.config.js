/**
 * Exposes the RoadSense v2 design tokens to Tailwind so pages can write
 * `bg-surface`, `text-muted`, `border-line` instead of arbitrary values.
 * Values resolve to the CSS variables defined in `src/index.css`, which
 * mirror `mobile/src/theme.ts`.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                canvas: 'var(--rs-canvas)',
                rail: 'var(--rs-rail)',
                well: 'var(--rs-well)',
                surface: {
                    DEFAULT: 'var(--rs-surface)',
                    2: 'var(--rs-surface-2)',
                    3: 'var(--rs-surface-3)',
                },
                line: {
                    DEFAULT: 'var(--rs-line)',
                    strong: 'var(--rs-line-strong)',
                },
                ink: {
                    DEFAULT: 'var(--rs-text)',
                    muted: 'var(--rs-text-muted)',
                    faint: 'var(--rs-text-faint)',
                },
                primary: {
                    DEFAULT: 'var(--rs-primary)',
                    ink: 'var(--rs-primary-ink)',
                    soft: 'var(--rs-primary-soft)',
                    edge: 'var(--rs-primary-edge)',
                },
                secondary: {
                    DEFAULT: 'var(--rs-secondary)',
                    soft: 'var(--rs-secondary-soft)',
                    edge: 'var(--rs-secondary-edge)',
                },
                warn: {
                    DEFAULT: 'var(--rs-warn)',
                    soft: 'var(--rs-warn-soft)',
                    edge: 'var(--rs-warn-edge)',
                },
                danger: {
                    DEFAULT: 'var(--rs-danger)',
                    soft: 'var(--rs-danger-soft)',
                    edge: 'var(--rs-danger-edge)',
                },
                success: {
                    DEFAULT: 'var(--rs-success)',
                    soft: 'var(--rs-success-soft)',
                    edge: 'var(--rs-success-edge)',
                },
            },
            borderRadius: {
                sm: 'var(--rs-r-sm)',
                md: 'var(--rs-r-md)',
                lg: 'var(--rs-r-lg)',
                xl: 'var(--rs-r-xl)',
                '2xl': 'var(--rs-r-2xl)',
            },
            boxShadow: {
                card: 'var(--rs-shadow-card)',
                raised: 'var(--rs-shadow-raised)',
            },
            fontFamily: {
                display: ['Inter', 'sans-serif'],
                body: ['Inter', 'sans-serif'],
                mono: ['"JetBrains Mono"', 'monospace'],
            },
        },
    },
    plugins: [],
}
