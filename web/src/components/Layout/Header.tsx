import { Menu } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../AuthProvider'
import { Pill } from '../ui'

/**
 * A thin bar: breadcrumb on the left, role badge on the right. The
 * identity block lives in the sidebar, so it is deliberately absent here.
 */
export default function Header({
    title,
    onMenuClick,
}: {
    title: string
    kicker?: string
    onMenuClick?: () => void
}) {
    const { isAdmin } = useAuth()

    return (
        <header className="sticky top-0 z-20 -mx-5 px-5 md:-mx-7 md:px-7 xl:-mx-9 xl:px-9 bg-[var(--rs-canvas)] border-b border-[var(--rs-line)]">
            <div className="flex items-center justify-between gap-3 h-[68px] max-w-[1500px] w-full mx-auto">
                <div className="flex items-center gap-3 min-w-0">
                    <button
                        type="button"
                        onClick={onMenuClick}
                        className="md:hidden rs-icon-button"
                        aria-label="Toggle menu"
                    >
                        <Menu size={16} />
                    </button>
                    <nav className="rs-crumb min-w-0" aria-label="Breadcrumb">
                        <Link to="/dashboard" className="rs-crumb-root hidden sm:inline">
                            RoadSense
                        </Link>
                        <span className="rs-crumb-sep hidden sm:inline" aria-hidden="true">
                            /
                        </span>
                        <span className="rs-crumb-current truncate">{title}</span>
                    </nav>
                </div>

                <Pill tone="neutral">{isAdmin ? 'Administrator' : 'Member'}</Pill>
            </div>
        </header>
    )
}
