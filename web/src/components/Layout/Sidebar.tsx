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
} from 'lucide-react'

export default function Sidebar() {
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
        <div className="w-72 m-3 rs-panel flex flex-col overflow-hidden">
            <div className="p-6 border-b border-[var(--rs-border)]">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl text-[var(--rs-text)]">RoadSense</h1>
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
    )
}
