import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../AuthProvider'
import {
    LayoutDashboard,
    Map,
    AlertTriangle,
    Users,
    UserCircle2,
    LogOut,
    Info,
    X,
} from 'lucide-react'

export default function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const location = useLocation()
    const { signOut, isAdmin } = useAuth()

    const menuItems = [
        { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', adminOnly: false },
        { path: '/map', icon: Map, label: 'Map View', adminOnly: false },
        { path: '/anomalies', icon: AlertTriangle, label: 'Anomalies', adminOnly: false },
        { path: '/about', icon: Info, label: 'About', adminOnly: false },
        { path: '/profile', icon: UserCircle2, label: 'Profile', adminOnly: false },
        { path: '/users', icon: Users, label: 'Users', adminOnly: true },
    ].filter((item) => (item.adminOnly ? isAdmin : true))

    return (
        <>
            <button
                type="button"
                aria-label="Close menu overlay"
                onClick={onClose}
                className={`fixed inset-0 z-30 bg-[rgba(1,7,16,0.68)] md:hidden ${isOpen ? 'block' : 'hidden'}`}
            />
            <div
                className={`fixed md:relative z-40 top-3 bottom-3 left-3 w-[min(86vw,18rem)] md:w-72 md:m-3 rs-panel flex flex-col overflow-hidden transition-transform duration-200 ${
                    isOpen ? 'translate-x-0' : '-translate-x-[120%] md:translate-x-0'
                }`}
            >
                <div className="p-5 md:p-6 border-b border-[var(--rs-border)]">
                    <div className="flex items-center justify-between mb-3 md:mb-2">
                        <div className="flex items-center gap-3 min-w-0">
                            <img src="/roadsense-icon.svg" alt="RoadSense icon" className="w-8 h-8 shrink-0" />
                            <h1 className="text-2xl text-[var(--rs-text)] truncate">RoadSense</h1>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--rs-border-soft)] text-[var(--rs-muted)]"
                            aria-label="Close menu"
                        >
                            <X size={16} />
                        </button>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="rs-chip">{isAdmin ? 'Admin' : 'Member'}</span>
                    </div>
                    <p className="text-[var(--rs-muted)] text-sm mt-2">
                        Dashboard access for authenticated users. User administration stays restricted.
                    </p>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    {menuItems.map((item) => {
                        const Icon = item.icon
                        const isActive = location.pathname === item.path

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                onClick={onClose}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                                    isActive
                                        ? 'bg-[linear-gradient(120deg,#1e4e78,#2a6ca7)] text-white border border-[#4583b5]'
                                        : 'text-[var(--rs-muted)] hover:text-[var(--rs-text)] hover:bg-[rgba(53,84,124,0.24)]'
                                }`}
                            >
                                <Icon size={20} />
                                <span className="font-medium">{item.label}</span>
                            </Link>
                        )
                    })}
                </nav>

                <div className="p-4 border-t border-[var(--rs-border)]">
                    <button
                        onClick={() => void signOut()}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-[var(--rs-muted)] hover:text-[var(--rs-text)] hover:bg-[rgba(255,107,95,0.14)] w-full transition-colors"
                    >
                        <LogOut size={20} />
                        <span className="font-medium">Sign Out</span>
                    </button>
                </div>
            </div>
        </>
    )
}
