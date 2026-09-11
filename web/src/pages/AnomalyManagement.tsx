import { useEffect, useState } from 'react'
import {
    getAllAnomalies,
    getNearbyAnomalies,
    getRecentImprovedAnomalies,
    verifyAnomaly,
    deleteAnomaly,
} from '../lib/queries'
import { Anomaly } from '../lib/supabase'
import { CheckCircle, Trash2, Filter, LocateFixed, Clock3, AlertTriangle } from 'lucide-react'
import LoaderBars from '../components/LoaderBars'
import { Card, Pill, EmptyState, Button, IconButton } from '../components/ui'

export default function AnomalyManagement() {
    const [anomalies, setAnomalies] = useState<Anomaly[]>([])
    const [recentImproved, setRecentImproved] = useState<Anomaly[]>([])
    const [loading, setLoading] = useState(true)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [filter, setFilter] = useState<'all' | 'POTHOLE' | 'SPEED_BUMP'>('all')
    const [verifiedFilter, setVerifiedFilter] = useState<'all' | 'repaired' | 'not_repaired'>('all')
    const [locationMode, setLocationMode] = useState<'all' | 'nearby'>('all')
    const [radiusKm, setRadiusKm] = useState(5)
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
    const [locating, setLocating] = useState(false)
    const [locationError, setLocationError] = useState<string | null>(null)
    const [reportDays, setReportDays] = useState<7 | 30 | 90>(30)

    useEffect(() => {
        void loadAnomalies()
    }, [filter, verifiedFilter, locationMode, radiusKm, userLocation?.lat, userLocation?.lng])

    useEffect(() => {
        void loadRecentImproved(reportDays)
    }, [reportDays])

    async function requestLocation() {
        if (!navigator.geolocation) {
            setLocationError('Geolocation is not supported on this browser.')
            return
        }

        setLocating(true)
        setLocationError(null)

        await new Promise<void>((resolve) => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    })
                    resolve()
                },
                () => {
                    setLocationError('Could not access your location. Please allow location permission.')
                    resolve()
                },
                { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
            )
        })

        setLocating(false)
    }

    async function loadRecentImproved(days = reportDays) {
        try {
            const data = await getRecentImprovedAnomalies(8, days)
            setRecentImproved(data)
        } catch (error) {
            console.error('Error loading recent improved anomalies:', error)
        }
    }

    async function loadAnomalies() {
        try {
            setLoading(true)
            setErrorMessage(null)
            const filters: any = {}
            if (filter !== 'all') filters.type = filter
            if (verifiedFilter === 'repaired') filters.verified = true
            if (verifiedFilter === 'not_repaired') filters.verified = false

            if (locationMode === 'nearby') {
                if (!userLocation) {
                    setAnomalies([])
                    setLoading(false)
                    return
                }

                const data = await getNearbyAnomalies(userLocation.lat, userLocation.lng, radiusKm, filters)
                setAnomalies(data)
                return
            }

            const data = await getAllAnomalies(filters)
            setAnomalies(data)
        } catch (error) {
            console.error('Error loading anomalies:', error)
            setErrorMessage('Could not load anomalies. Please check database permissions and try again.')
        } finally {
            setLoading(false)
        }
    }

    async function handleVerify(id: string) {
        try {
            await verifyAnomaly(id)
            await Promise.all([loadAnomalies(), loadRecentImproved(reportDays)])
        } catch (error) {
            console.error('Error verifying anomaly:', error)
            alert('Failed to verify anomaly')
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Delete this anomaly? This cannot be undone.')) return

        try {
            await deleteAnomaly(id)
            await Promise.all([loadAnomalies(), loadRecentImproved(reportDays)])
        } catch (error) {
            console.error('Error deleting anomaly:', error)
            alert('Failed to delete anomaly')
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <LoaderBars label="Loading anomalies" />
            </div>
        )
    }

    const toNumber = (value: unknown, fallback = 0) => {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : fallback
    }

    const improvedPotholes = recentImproved.filter((item) => item.type === 'POTHOLE').length
    const improvedSpeedBumps = recentImproved.filter((item) => item.type === 'SPEED_BUMP').length

    return (
        <div className="space-y-5 rs-fade-up">
            {errorMessage && (
                <div className="rs-banner rs-banner-warn">{errorMessage}</div>
            )}

            {/* Filter bar. Controls wrap on narrow screens rather than scrolling sideways. */}
            <Card className="p-4">
                <div className="flex flex-wrap items-center gap-2.5">
                    <Filter size={15} className="text-[var(--rs-text-faint)] shrink-0" />
                    <select
                        value={filter}
                        onChange={(event) => setFilter(event.target.value as any)}
                        className="rs-select w-auto min-w-[8.5rem] py-2 text-sm"
                        aria-label="Filter by type"
                    >
                        <option value="all">All types</option>
                        <option value="POTHOLE">Potholes</option>
                        <option value="SPEED_BUMP">Speed bumps</option>
                    </select>

                    <select
                        value={verifiedFilter}
                        onChange={(event) => setVerifiedFilter(event.target.value as any)}
                        className="rs-select w-auto min-w-[9rem] py-2 text-sm"
                        aria-label="Filter by status"
                    >
                        <option value="all">All status</option>
                        <option value="repaired">Repaired</option>
                        <option value="not_repaired">Not repaired</option>
                    </select>

                    <select
                        value={locationMode}
                        onChange={(event) => setLocationMode(event.target.value as 'all' | 'nearby')}
                        className="rs-select w-auto min-w-[9rem] py-2 text-sm"
                        aria-label="Filter by location"
                    >
                        <option value="all">All locations</option>
                        <option value="nearby">Nearby me</option>
                    </select>

                    {locationMode === 'nearby' && (
                        <>
                            <select
                                value={radiusKm}
                                onChange={(event) => setRadiusKm(Number(event.target.value))}
                                className="rs-select w-auto min-w-[8rem] py-2 text-sm"
                                aria-label="Search radius"
                            >
                                <option value={1}>Within 1 km</option>
                                <option value={3}>Within 3 km</option>
                                <option value={5}>Within 5 km</option>
                                <option value={10}>Within 10 km</option>
                                <option value={20}>Within 20 km</option>
                            </select>

                            <Button
                                variant="secondary"
                                icon={LocateFixed}
                                onClick={() => void requestLocation()}
                                disabled={locating}
                                className="py-2 text-sm"
                            >
                                {locating ? 'Locating…' : userLocation ? 'Refresh location' : 'Use my location'}
                            </Button>
                        </>
                    )}

                    <span className="ml-auto text-[14px] text-[var(--rs-text-muted)] shrink-0">
                        {anomalies.length} results
                    </span>
                </div>

                {locationMode === 'nearby' && !userLocation && (
                    <p className="text-[13px] rs-muted mt-3">Choose Use my location to see nearby anomalies.</p>
                )}
                {locationMode === 'nearby' && userLocation && (
                    <p className="text-[13px] rs-muted mt-3">
                        Within {radiusKm} km of{' '}
                        <span className="rs-mono text-[var(--rs-text)]">
                            {toNumber(userLocation.lat).toFixed(4)}, {toNumber(userLocation.lng).toFixed(4)}
                        </span>
                    </p>
                )}
                {locationError && <p className="text-[13px] text-[var(--rs-warn)] mt-3">{locationError}</p>}
            </Card>

            <Card className="overflow-hidden">
                <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--rs-line)]">
                    <div>
                        <h2 className="rs-heading inline-flex items-center gap-2">
                            <Clock3 size={16} className="text-[var(--rs-success)]" />
                            Recently Improved Roads
                        </h2>
                        <p className="text-[13px] text-[var(--rs-text-faint)] mt-0.5">
                            Latest repaired potholes and speed bumps
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <Pill tone="danger">{improvedPotholes} potholes</Pill>
                        <Pill tone="warn">{improvedSpeedBumps} bumps</Pill>
                        <select
                            value={reportDays}
                            onChange={(event) => setReportDays(Number(event.target.value) as 7 | 30 | 90)}
                            className="rs-select w-auto min-w-[8.5rem] py-2 text-sm"
                            aria-label="Report window"
                        >
                            <option value={7}>Last 7 days</option>
                            <option value={30}>Last 30 days</option>
                            <option value={90}>Last 90 days</option>
                        </select>
                    </div>
                </div>

                {recentImproved.length === 0 ? (
                    <EmptyState
                        icon={Clock3}
                        title="No recent improvements"
                        description="Nothing was marked repaired in this window."
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="rs-table min-w-[42rem]">
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th>Location</th>
                                    <th>Updated</th>
                                    <th>Confidence</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentImproved.map((item) => (
                                    <tr key={`improved-${item.id}`}>
                                        <td>
                                            <Pill tone={item.type === 'POTHOLE' ? 'danger' : 'warn'}>
                                                {item.type === 'POTHOLE' ? 'Pothole' : 'Speed Bump'}
                                            </Pill>
                                        </td>
                                        <td className="rs-mono text-xs rs-muted whitespace-nowrap">
                                            {toNumber(item.latitude).toFixed(4)}, {toNumber(item.longitude).toFixed(4)}
                                        </td>
                                        <td className="rs-muted whitespace-nowrap">
                                            {new Date(item.updated_at || item.created_at).toLocaleString()}
                                        </td>
                                        <td className="rs-mono text-[var(--rs-text)]">
                                            {(toNumber(item.confidence) * 100).toFixed(0)}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            <Card className="overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--rs-line)]">
                    <h2 className="rs-heading">All Anomalies</h2>
                </div>

                <div className="overflow-x-auto">
                    <table className="rs-table min-w-[56rem]">
                        <thead>
                            <tr>
                                <th>Type</th>
                                <th>Location</th>
                                <th>Severity</th>
                                <th>Confidence</th>
                                <th>Status</th>
                                <th>Date</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {anomalies.map((anomaly) => (
                                <tr key={anomaly.id}>
                                    <td>
                                        <Pill tone={anomaly.type === 'POTHOLE' ? 'danger' : 'warn'}>
                                            {anomaly.type === 'POTHOLE' ? 'Pothole' : 'Speed Bump'}
                                        </Pill>
                                    </td>
                                    <td className="rs-mono text-xs rs-muted whitespace-nowrap">
                                        {toNumber(anomaly.latitude).toFixed(4)}, {toNumber(anomaly.longitude).toFixed(4)}
                                    </td>
                                    <td>
                                        {(() => {
                                            const band = severityBand(toNumber(anomaly.severity))
                                            return <Pill tone={band.tone}>{band.label}</Pill>
                                        })()}
                                    </td>
                                    <td className="rs-mono text-[var(--rs-text)]">
                                        {(toNumber(anomaly.confidence) * 100).toFixed(0)}%
                                    </td>
                                    <td>
                                        {anomaly.verified ? (
                                            <Pill tone="success">Verified</Pill>
                                        ) : (
                                            <Pill tone="neutral">Pending</Pill>
                                        )}
                                    </td>
                                    <td className="rs-muted rs-mono text-xs whitespace-nowrap">
                                        {new Date(anomaly.created_at).toLocaleDateString()}
                                    </td>
                                    <td>
                                        <div className="flex gap-2 justify-end">
                                            {!anomaly.verified && (
                                                <IconButton
                                                    icon={CheckCircle}
                                                    label="Verify anomaly"
                                                    onClick={() => handleVerify(anomaly.id)}
                                                    className="h-8 w-8 hover:!text-[var(--rs-success)] hover:!border-[var(--rs-success-edge)]"
                                                />
                                            )}
                                            <IconButton
                                                icon={Trash2}
                                                label="Delete anomaly"
                                                onClick={() => handleDelete(anomaly.id)}
                                                className="h-8 w-8 hover:!text-[var(--rs-danger)] hover:!border-[var(--rs-danger-edge)]"
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {anomalies.length === 0 && (
                                <tr>
                                    <td colSpan={7}>
                                        <EmptyState
                                            icon={AlertTriangle}
                                            title="No anomalies found"
                                            description="Adjust the filters above to widen the search."
                                        />
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    )
}

/** Severity as a readable band. Thresholds match the app's alert levels. */
function severityBand(severity: number): { label: string; tone: 'danger' | 'warn' | 'neutral' } {
    if (severity >= 0.7) return { label: 'High', tone: 'danger' }
    if (severity >= 0.4) return { label: 'Medium', tone: 'warn' }
    return { label: 'Low', tone: 'neutral' }
}
