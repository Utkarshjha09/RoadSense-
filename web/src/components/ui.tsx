/**
 * RoadSense UI kit — web
 * ---------------------------------------------------------------
 * Ported from the mobile app's screens so both products share one
 * visual language. Each component notes the app file it came from.
 */

import type { ReactNode, ButtonHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'

export type Tone = 'primary' | 'secondary' | 'warn' | 'danger' | 'success' | 'neutral'

export const TONE_TEXT: Record<Tone, string> = {
    primary: 'text-[var(--rs-primary-text)]',
    secondary: 'text-[var(--rs-secondary)]',
    warn: 'text-[var(--rs-warn)]',
    danger: 'text-[var(--rs-danger)]',
    success: 'text-[var(--rs-success)]',
    neutral: 'text-[var(--rs-text)]',
}

export const TONE_VAR: Record<Tone, string> = {
    primary: 'var(--rs-primary)',
    secondary: 'var(--rs-secondary)',
    warn: 'var(--rs-warn)',
    danger: 'var(--rs-danger)',
    success: 'var(--rs-success)',
    neutral: 'var(--rs-text-faint)',
}

/* -------------------------------------------------------------- */

export function Card({
    children,
    className = '',
    interactive = false,
    soft = false,
}: {
    children: ReactNode
    className?: string
    interactive?: boolean
    soft?: boolean
}) {
    return (
        <div className={`${soft ? 'rs-panel-soft' : 'rs-panel'} ${interactive ? 'rs-panel-interactive' : ''} ${className}`}>
            {children}
        </div>
    )
}

/**
 * Label, headline figure, caption. Pass `value={null}` while the number
 * is unavailable and the card shows a dash rather than a misleading zero.
 */
export function StatCard({
    label,
    value,
    caption,
    tone = 'neutral',
    className = '',
}: {
    label: string
    value: string | number | null
    caption?: string
    tone?: Tone
    className?: string
}) {
    return (
        <div className={`rs-stat ${className}`}>
            <p className="rs-stat-label">{label}</p>
            {value === null ? (
                <span className="rs-stat-empty" aria-label="No data" />
            ) : (
                <p className={`rs-metric ${tone === 'neutral' ? '' : TONE_TEXT[tone]}`}>{value}</p>
            )}
            {caption ? <p className="rs-micro">{caption}</p> : null}
        </div>
    )
}

export function Pill({ children, tone = 'primary', icon: Icon }: { children: ReactNode; tone?: Tone; icon?: LucideIcon }) {
    return (
        <span className={`rs-pill rs-pill-${tone}`}>
            {Icon ? <Icon size={10} /> : null}
            {children}
        </span>
    )
}

export function Divider({ className = '' }: { className?: string }) {
    return <div className={`rs-divider ${className}`} />
}

/**
 * home.tsx `sectionHeader`. In the app a section heading is a small
 * tracked uppercase label with an optional trailing link, never a
 * large title. Keep it that way so the two products match.
 */
export function SectionHeader({
    title,
    action,
    className = '',
}: {
    title: string
    action?: ReactNode
    className?: string
}) {
    return (
        <div className={`flex items-center justify-between gap-3 mb-3 ${className}`}>
            <p className="rs-section-title">{title}</p>
            {action ? <div className="shrink-0">{action}</div> : null}
        </div>
    )
}

/** home.tsx `seeAllText`. */
export function SeeAll({ children = 'See all' }: { children?: ReactNode }) {
    return <span className="text-[11px] text-[var(--rs-primary)]">{children}</span>
}

/**
 * home.tsx `summaryCard`. One card, stats side by side, each centered
 * with a display-font value over a 9px label.
 */
export function SummaryRow({
    items,
    className = '',
}: {
    items: { label: string; value: string | number; tone?: Tone }[]
    className?: string
}) {
    return (
        <Card className={`flex ${className}`}>
            {items.map((item, index) => (
                <div
                    key={item.label}
                    /* Hairlines keep the stats reading as one group once the card
                       stretches to desktop width. */
                    className={`flex-1 flex flex-col items-center justify-center py-4 px-2 ${
                        index > 0 ? 'border-l border-[var(--rs-line)]' : ''
                    }`}
                >
                    <p className={`rs-metric ${TONE_TEXT[item.tone ?? 'neutral']}`}>{item.value}</p>
                    <p className="rs-micro mt-[3px]">{item.label}</p>
                </div>
            ))}
        </Card>
    )
}

/**
 * home.tsx `statusStrip`. Live dot, green status line, optional pill,
 * then a row of evenly spaced mini readouts.
 */
export function StatusStrip({
    label,
    live = true,
    badge,
    items,
}: {
    label: string
    live?: boolean
    badge?: string
    items: { label: string; value: string; tone?: Tone }[]
}) {
    return (
        <Card soft className="px-[14px] py-3">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <span className={`rs-dot ${live ? 'rs-dot-live' : ''}`} />
                    <span className="text-xs font-semibold text-[var(--rs-success)]">{label}</span>
                </div>
                {badge ? <Pill tone="primary">{badge}</Pill> : null}
            </div>
            <div className="flex mt-3">
                {items.map((item) => (
                    <div key={item.label} className="flex-1 flex flex-col items-center">
                        <p className={`rs-metric-sm ${TONE_TEXT[item.tone ?? 'neutral']}`}>{item.value}</p>
                        <p className="rs-micro mt-[2px]">{item.label}</p>
                    </div>
                ))}
            </div>
        </Card>
    )
}

/**
 * home.tsx `quickTile`. Card with a 2px accent top border, icon,
 * title, and a faint subtitle.
 */
export function QuickTile({
    icon: Icon,
    title,
    subtitle,
    tone = 'primary',
    onClick,
}: {
    icon: LucideIcon
    title: string
    subtitle: string
    tone?: Tone
    onClick?: () => void
}) {
    return (
        <button type="button" onClick={onClick} className={`rs-quick-tile rs-quick-tile-${tone} text-left`}>
            <Icon size={22} strokeWidth={1.6} style={{ color: TONE_VAR[tone] }} />
            <p className="rs-heading">{title}</p>
            <p className="text-[11px] text-[var(--rs-text-faint)] -mt-[6px]">{subtitle}</p>
        </button>
    )
}

/**
 * home.tsx `detectionRow`. Colored spine, title with an optional pill,
 * a faint meta line, and a trailing slot.
 */
export function DetectionRow({
    tone,
    title,
    meta,
    badge,
    trailing,
}: {
    tone: Tone
    title: string
    meta: string
    badge?: ReactNode
    trailing?: ReactNode
}) {
    return (
        <div className="flex items-center gap-3 p-[14px]">
            <span className="rs-spine" style={{ background: TONE_VAR[tone] }} />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-[3px]">
                    <p className="text-[13px] font-semibold text-[var(--rs-text)] truncate">{title}</p>
                    {badge}
                </div>
                <p className="text-[11px] text-[var(--rs-text-faint)]">{meta}</p>
            </div>
            {trailing ? <div className="shrink-0">{trailing}</div> : null}
        </div>
    )
}

/** home.tsx `legendRow`. */
export function Legend({ items }: { items: { label: string; tone: Tone }[] }) {
    return (
        <div className="flex gap-3">
            {items.map((item) => (
                <div key={item.label} className="flex items-center gap-[5px]">
                    <span className="w-[6px] h-[6px] rounded-[2px]" style={{ background: TONE_VAR[item.tone] }} />
                    <span className="rs-micro">{item.label}</span>
                </div>
            ))}
        </div>
    )
}

/* -------------------------------------------------------------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    icon?: LucideIcon
    children: ReactNode
}

export function Button({ variant = 'primary', icon: Icon, children, className = '', ...rest }: ButtonProps) {
    return (
        <button className={`rs-button-${variant} ${className}`} {...rest}>
            {Icon ? <Icon size={16} /> : null}
            {children}
        </button>
    )
}

export function IconButton({
    icon: Icon,
    label,
    className = '',
    ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string }) {
    return (
        <button type="button" aria-label={label} className={`rs-icon-button ${className}`} {...rest}>
            <Icon size={16} />
        </button>
    )
}

/** home.tsx `emptyDetections`. */
export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
}: {
    icon?: LucideIcon
    title: string
    description?: string
    action?: ReactNode
}) {
    return (
        <div className="flex flex-col items-center justify-center text-center gap-2 py-6 px-5">
            {Icon ? <Icon size={18} className="text-[var(--rs-text-faint)]" /> : null}
            <p className="text-[13px] font-semibold text-[var(--rs-text)]">{title}</p>
            {description ? <p className="text-xs text-[var(--rs-text-muted)] max-w-xs">{description}</p> : null}
            {action}
        </div>
    )
}

export function Skeleton({ className = '' }: { className?: string }) {
    return <div className={`rs-skeleton ${className}`} />
}
