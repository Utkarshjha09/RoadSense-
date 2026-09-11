import { Link, useLocation } from 'react-router-dom'
import { LogOut, X } from 'lucide-react'
import { useAuth } from '../AuthProvider'
import { visibleNavItems } from './nav-items'

export default function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const location = useLocation()
    const { signOut, isAdmin, user, profile } = useAuth()
    const menuItems = visibleNavItems(isAdmin)

    const displayName = profile?.full_name?.trim() || user?.email || 'User'
    const roleLabel = profile?.role ? profile.role[0].toUpperCase() + profile.role.slice(1) : 'Driver'
    const initials =
        displayName
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase())
            .join('') || '?'

    return (
        <>
            {/* Scrim, only on small screens where the sidebar is a drawer. */}
            <button
                type="button"
                aria-label="Close menu overlay"
                onClick={onClose}
                className={`fixed inset-0 z-30 bg-black/70 backdrop-blur-sm md:hidden transition-opacity duration-200 ${
                    isOpen ? 'block opacity-100' : 'hidden opacity-0'
                }`}
            />

            <aside
                className={`fixed md:sticky z-40 top-0 h-[100dvh] left-0 w-[min(84vw,17rem)] md:w-[17rem] shrink-0 bg-[var(--rs-rail)] border-r border-[var(--rs-line)] flex flex-col transition-transform duration-200 ease-out ${
                    isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
                }`}
            >
                {/* Wordmark */}
                <div className="h-[68px] px-4 flex items-center justify-between gap-3 border-b border-[var(--rs-line)]">
                    <Link to="/dashboard" onClick={onClose} className="flex items-center gap-2.5 min-w-0 no-underline">
                        <span className="rs-logo-tile">
                            <img src="/roadsense-icon.svg" alt="" className="w-4 h-4" />
                        </span>
                        <span className="text-[17px] font-semibold text-[var(--rs-text)] truncate">RoadSense</span>
                    </Link>
                    <button type="button" onClick={onClose} className="md:hidden rs-icon-button h-8 w-8" aria-label="Close menu">
                        <X size={15} />
                    </button>
                </div>

                {/* Identity */}
                <div className="px-4 py-4 flex items-center gap-3 border-b border-[var(--rs-line)]">
                    <span className="rs-avatar">{initials}</span>
                    <div className="min-w-0">
                        <p className="text-[14px] font-medium text-[var(--rs-text)] truncate">{displayName}</p>
                        <p className="text-[13px] text-[var(--rs-text-faint)] truncate">{roleLabel}</p>
                    </div>
                </div>

                <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                    {menuItems.map((item) => {
                        const Icon = item.icon
                        const isActive = location.pathname === item.path

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                onClick={onClose}
                                aria-current={isActive ? 'page' : undefined}
                                className={`rs-nav-item no-underline ${isActive ? 'rs-nav-item-active' : ''}`}
                            >
                                <Icon size={18} strokeWidth={1.8} />
                                <span className="truncate">{item.label}</span>
                            </Link>
                        )
                    })}
                </nav>

                <div className="p-3 border-t border-[var(--rs-line)]">
                    <button
                        type="button"
                        onClick={() => void signOut()}
                        className="rs-nav-item w-full hover:!text-[var(--rs-danger)] hover:!bg-[var(--rs-danger-soft)]"
                    >
                        <LogOut size={18} strokeWidth={1.8} />
                        <span>Sign Out</span>
                    </button>
                </div>
            </aside>
        </>
    )
}
