import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { useLocation } from 'react-router-dom'

const pageTitles: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/map': 'Map View',
    '/anomalies': 'Anomaly Management',
    '/users': 'User Management',
}

export default function Layout() {
    const location = useLocation()
    const title = pageTitles[location.pathname] || 'RoadSense Admin'

    return (
        <div className="flex h-screen bg-slate-900">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <Header title={title} />
                <main className="flex-1 overflow-auto p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
