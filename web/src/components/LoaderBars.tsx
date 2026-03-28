type LoaderBarsProps = {
    label?: string
    compact?: boolean
}

export default function LoaderBars({ label = 'Loading...', compact = false }: LoaderBarsProps) {
    return (
        <div className={`rs-loader-wrap ${compact ? 'rs-loader-wrap-compact' : ''}`}>
            <div className="rs-loader" aria-hidden="true">
                <div className="rs-loader-bar rs-loader-bar-1" />
                <div className="rs-loader-bar rs-loader-bar-2" />
                <div className="rs-loader-bar rs-loader-bar-3" />
                <div className="rs-loader-bar rs-loader-bar-4" />
            </div>
            <p className="rs-loader-label">{label}</p>
        </div>
    )
}

