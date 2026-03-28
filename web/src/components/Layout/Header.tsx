import { useAuth } from '../AuthProvider'

export default function Header({ title }: { title: string }) {
    const { user, profile } = useAuth()
    const displayName = profile?.full_name?.trim() || user?.email || 'User'
    const roleLabel = profile?.role === 'admin'
        ? 'Administrator'
        : profile?.role === 'owner'
            ? 'Owner'
            : 'Driver'

    return (
        <div className="mx-6 mt-3 px-6 py-4 rs-panel-soft flex items-center justify-between">
            <div>
                <p className="text-xs tracking-[0.16em] uppercase text-[var(--rs-muted)] mb-1">RoadSense Control</p>
                <h2 className="text-3xl text-[var(--rs-text)] leading-tight">{title}</h2>
            </div>

            <div className="flex items-center gap-4">
                <div className="text-right">
                    <p className="text-sm font-semibold text-[var(--rs-text)]">{displayName}</p>
                    <p className="text-xs text-[var(--rs-muted)]">{roleLabel}</p>
                </div>
                <div className="w-11 h-11 rounded-full flex items-center justify-center border border-[#6ea3d5] bg-[linear-gradient(140deg,#2c5f90,#4b8cc6)] shadow-lg">
                    <span className="text-white font-semibold">
                        {displayName.charAt(0).toUpperCase()}
                    </span>
                </div>
            </div>
        </div>
    )
}
