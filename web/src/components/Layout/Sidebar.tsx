import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../AuthProvider'
import {
    LayoutDashboard,
    Map,
    AlertTriangle,
    Users,
    LogOut
} from 'lucide-react'

export default function Sidebar() {
    const location = useLocation()
    const { signOut } = useAuth()

    const menuItems = [
        { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/map', icon: Map, label: 'Map View' },
        { path: '/anomalies', icon: AlertTriangle, label: 'Anomalies' },
        { path: '/users', icon: Users, label: 'Users' },
    ]

    return (
        <div className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col">
            <div className="p-6 border-b border-slate-700">
                <h1 className="text-2xl font-bold text-white">RoadSense</h1>
                <p className="text-slate-400 text-sm">Admin Dashboard</p>
            </div>

            <nav className="flex-1 p-4 space-y-2">
                {menuItems.map((item) => {
                    const Icon = item.icon
                    const isActive = location.pathname === item.path

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                                    ? 'bg-blue-600 text-white'
                                    : 'text-slate-300 hover:bg-slate-700'
                                }`}
                        >
                            <Icon size={20} />
                            <span className="font-medium">{item.label}</span>
                        </Link>
                    )
                })}
            </nav>

            <div className="p-4 border-t border-slate-700">
                <button
                    onClick={() => signOut()}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-700 w-full transition-colors"
                >
                    <LogOut size={20} />
                    <span className="font-medium">Sign Out</span>
                </button>
            </div>
        </div>
    )
}
