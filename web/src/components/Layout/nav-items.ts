import {
    LayoutDashboard,
    Map,
    AlertTriangle,
    BarChart3,
    Users,
    UserCircle2,
    Info,
    type LucideIcon,
} from 'lucide-react'

export type NavItem = {
    path: string
    icon: LucideIcon
    label: string
    /** Shorter label for the compact bottom tab bar. */
    shortLabel: string
    adminOnly: boolean
    /** Shown in the bottom tab bar on small screens. */
    primary: boolean
}

/**
 * Single source of nav truth for both the sidebar and the bottom tab
 * bar, so the two never drift. The `primary` items mirror the app's
 * <BottomNavBar /> tabs.
 */
export const NAV_ITEMS: NavItem[] = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', shortLabel: 'Home', adminOnly: false, primary: true },
    { path: '/map', icon: Map, label: 'Map View', shortLabel: 'Map', adminOnly: false, primary: true },
    { path: '/anomalies', icon: AlertTriangle, label: 'Anomalies', shortLabel: 'Alerts', adminOnly: false, primary: true },
    { path: '/reports', icon: BarChart3, label: 'Reports', shortLabel: 'Reports', adminOnly: false, primary: true },
    { path: '/profile', icon: UserCircle2, label: 'Profile', shortLabel: 'Profile', adminOnly: false, primary: true },
    { path: '/users', icon: Users, label: 'Users', shortLabel: 'Users', adminOnly: true, primary: false },
    { path: '/about', icon: Info, label: 'About', shortLabel: 'About', adminOnly: false, primary: false },
]

export function visibleNavItems(isAdmin: boolean) {
    return NAV_ITEMS.filter((item) => (item.adminOnly ? isAdmin : true))
}
