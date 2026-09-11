import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import BottomNav from './BottomNav'

/** Breadcrumb leaf for each route. */
const PAGE_TITLES: Record<string, string> = {
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
    const title = PAGE_TITLES[location.pathname] ?? 'RoadSense'
    const [sidebarOpen, setSidebarOpen] = useState(false)

    // Close the drawer on navigation so it never lingers over a new page.
    useEffect(() => {
        setSidebarOpen(false)
    }, [location.pathname])

    // Lock body scroll while the drawer is open on small screens.
    useEffect(() => {
        document.body.style.overflow = sidebarOpen ? 'hidden' : ''
        return () => {
            document.body.style.overflow = ''
        }
    }, [sidebarOpen])

    return (
        <div className="min-h-[100dvh] flex">
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 min-w-0 flex flex-col">
                {/* The app's 20px phone gutter, opened up as the viewport grows. */}
                <div className="px-5 md:px-7 xl:px-9">
                    <Header title={title} onMenuClick={() => setSidebarOpen((value) => !value)} />

                    {/* Bottom padding clears the mobile tab bar. */}
                    <main className="pt-6 pb-28 md:pb-10 max-w-[1500px] w-full mx-auto">
                        <Outlet />
                    </main>
                </div>
            </div>

            <BottomNav />
        </div>
    )
}
