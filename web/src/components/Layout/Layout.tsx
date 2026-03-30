import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { useLocation } from 'react-router-dom'

const pageTitles: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/map': 'Map View',
    '/anomalies': 'Anomaly Management',
    '/reports': 'Reports',
    '/users': 'User Management',
    '/profile': 'Profile',
    '/about': 'About',
}

export default function Layout() {
    const location = useLocation()
    const title = pageTitles[location.pathname] || 'RoadSense Admin'
    const [sidebarOpen, setSidebarOpen] = useState(false)

    return (
        <div className="flex min-h-screen md:h-screen rs-grid-bg">
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <div className="flex-1 flex flex-col overflow-hidden">
                <Header title={title} onMenuClick={() => setSidebarOpen((value) => !value)} />
                <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
