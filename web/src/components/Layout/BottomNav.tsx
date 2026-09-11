import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../AuthProvider'
import { visibleNavItems } from './nav-items'

/**
 * Direct web counterpart of the app's <BottomNavBar />, including the
 * soft cyan pill that sits behind the active tab's icon.
 */
export default function BottomNav() {
    const location = useLocation()
    const { isAdmin } = useAuth()
    const tabs = visibleNavItems(isAdmin).filter((item) => item.primary)

    return (
        <nav className="rs-tabbar md:hidden" aria-label="Primary">
            {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = location.pathname === tab.path

                return (
                    <Link
                        key={tab.path}
                        to={tab.path}
                        aria-current={isActive ? 'page' : undefined}
                        className={`rs-tabbar-item ${isActive ? 'rs-tabbar-item-active' : ''}`}
                    >
                        <span className="rs-tabbar-item-icon">
                            <Icon size={19} strokeWidth={isActive ? 2.1 : 1.75} />
                        </span>
                        <span>{tab.shortLabel}</span>
                    </Link>
                )
            })}
        </nav>
    )
}
