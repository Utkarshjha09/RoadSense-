import { Menu } from 'lucide-react'
import { useAuth } from '../AuthProvider'

export default function Header({ title, onMenuClick }: { title: string; onMenuClick?: () => void }) {
    const { user, profile } = useAuth()
    const displayName = profile?.full_name?.trim() || user?.email || 'User'
    const roleLabel = profile?.role === 'admin'
        ? 'Administrator'
        : profile?.role === 'owner'
            ? 'Owner'
            : 'Driver'

    return (
        <div className="mx-4 md:mx-6 mt-3 px-4 md:px-6 py-4 rs-panel-soft flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
                <button
                    type="button"
                    onClick={onMenuClick}
                    className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--rs-border-soft)] bg-[rgba(18,38,63,0.82)] text-[var(--rs-text)]"
                    aria-label="Toggle menu"
                >
                    <Menu size={18} />
                </button>
                <div className="min-w-0">
                    <p className="text-xs tracking-[0.16em] uppercase text-[var(--rs-muted)] mb-1">RoadSense Control</p>
                    <h2 className="text-xl sm:text-2xl md:text-3xl text-[var(--rs-text)] leading-tight truncate">{title}</h2>
                </div>
            </div>

            <div className="flex items-center gap-3 md:gap-4">
                <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold text-[var(--rs-text)]">{displayName}</p>
                    <p className="text-xs text-[var(--rs-muted)]">{roleLabel}</p>
                </div>
                <div className="w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center border border-[#6ea3d5] bg-[linear-gradient(140deg,#2c5f90,#4b8cc6)] shadow-lg">
                    <span className="text-white font-semibold">
                        {displayName.charAt(0).toUpperCase()}
                    </span>
                </div>
            </div>
        </div>
    )
}
