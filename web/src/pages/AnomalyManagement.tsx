import { useEffect, useState } from 'react'
import {
    getAllAnomalies,
    getNearbyAnomalies,
    getRecentImprovedAnomalies,
    verifyAnomaly,
    deleteAnomaly,
} from '../lib/queries'
import { Anomaly } from '../lib/supabase'
import { CheckCircle, Trash2, Filter, LocateFixed, Clock3 } from 'lucide-react'
import LoaderBars from '../components/LoaderBars'

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
                {
                    enableHighAccuracy: true,
                    timeout: 12000,
                    maximumAge: 30000,
                }
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

                const data = await getNearbyAnomalies(
                    userLocation.lat,
                    userLocation.lng,
                    radiusKm,
                    filters
                )
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
        if (!confirm('Are you sure you want to delete this anomaly?')) return

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
            <div className="flex items-center justify-center h-full">
                <LoaderBars label="Loading anomalies..." />
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
        <div className="space-y-6 rs-fade-up">
            {errorMessage && (
                <div className="rs-panel p-4 border border-rose-500/40 text-rose-300">
                    {errorMessage}
                </div>
            )}
            <div className="rs-panel p-6">
                <div className="flex items-center gap-4 flex-wrap">
                    <Filter className="text-[var(--rs-muted)]" size={20} />
                    <div className="flex gap-3 flex-wrap">
                        <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="rs-select w-auto min-w-[140px]">
                            <option value="all">All Types</option>
                            <option value="POTHOLE">Potholes</option>
                            <option value="SPEED_BUMP">Speed Bumps</option>
                        </select>

                        <select value={verifiedFilter} onChange={(e) => setVerifiedFilter(e.target.value as any)} className="rs-select w-auto min-w-[170px]">
                            <option value="all">All Status</option>
                            <option value="repaired">Repaired</option>
                            <option value="not_repaired">Not Repaired</option>
                        </select>

                        <select
                            value={locationMode}
                            onChange={(e) => setLocationMode(e.target.value as 'all' | 'nearby')}
                            className="rs-select w-auto min-w-[180px]"
                        >
                            <option value="all">All Locations</option>
                            <option value="nearby">Nearby Me</option>
                        </select>

                        {locationMode === 'nearby' && (
                            <>
                                <select
                                    value={radiusKm}
                                    onChange={(e) => setRadiusKm(Number(e.target.value))}
                                    className="rs-select w-auto min-w-[140px]"
                                >
                                    <option value={1}>Within 1 km</option>
                                    <option value={3}>Within 3 km</option>
                                    <option value={5}>Within 5 km</option>
                                    <option value={10}>Within 10 km</option>
                                    <option value={20}>Within 20 km</option>
                                </select>

                                <button
                                    type="button"
                                    onClick={() => void requestLocation()}
                                    disabled={locating}
                                    className="rs-button-secondary inline-flex items-center gap-2 px-4 py-2 disabled:opacity-60"
                                >
                                    <LocateFixed size={16} />
                                    {locating ? 'Getting location...' : userLocation ? 'Refresh My Location' : 'Use My Location'}
                                </button>
                            </>
                        )}
                    </div>
                    <div className="ml-auto text-[var(--rs-muted)]">{anomalies.length} anomalies</div>
                </div>
                {locationMode === 'nearby' && !userLocation && (
                    <p className="text-sm text-[var(--rs-muted)] mt-4">
                        Select Use My Location to show nearby anomalies.
                    </p>
                )}
                {locationMode === 'nearby' && userLocation && (
                    <p className="text-sm text-[var(--rs-muted)] mt-4">
                        Showing anomalies within {radiusKm} km of your location ({toNumber(userLocation.lat).toFixed(4)}, {toNumber(userLocation.lng).toFixed(4)}).
                    </p>
                )}
                {locationError && (
                    <p className="text-sm text-amber-300 mt-3">{locationError}</p>
                )}
            </div>

            <div className="rs-panel p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <h3 className="text-lg font-semibold text-[var(--rs-text)] inline-flex items-center gap-2">
                            <Clock3 size={18} />
                            Recently Improved Roads
                        </h3>
                        <p className="text-sm text-[var(--rs-muted)] mt-1">
                            Latest repaired potholes and speed bumps
                        </p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <select
                            value={reportDays}
                            onChange={(e) => setReportDays(Number(e.target.value) as 7 | 30 | 90)}
                            className="rs-select w-auto min-w-[170px]"
                        >
                            <option value={7}>Last 7 days</option>
                            <option value={30}>Last 30 days</option>
                            <option value={90}>Last 90 days</option>
                        </select>
                        <div className="text-sm text-[var(--rs-muted)]">
                            Potholes improved: <span className="text-[var(--rs-text)] font-semibold">{improvedPotholes}</span> • Speed bumps improved: <span className="text-[var(--rs-text)] font-semibold">{improvedSpeedBumps}</span>
                        </div>
                    </div>
                </div>

                {recentImproved.length === 0 ? (
                    <div className="text-sm text-[var(--rs-muted)] mt-4">No improved anomalies were updated recently.</div>
                ) : (
                    <div className="mt-4 overflow-x-auto">
                        <table className="w-full rs-table">
                            <thead>
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--rs-muted)] uppercase tracking-wider">Type</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--rs-muted)] uppercase tracking-wider">Location</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--rs-muted)] uppercase tracking-wider">Updated</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--rs-muted)] uppercase tracking-wider">Confidence</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--rs-border)]">
                                {recentImproved.map((item) => (
                                    <tr key={`improved-${item.id}`}>
                                        <td className="px-4 py-3 text-sm text-[var(--rs-text)]">{item.type === 'POTHOLE' ? 'Pothole' : 'Speed Bump'}</td>
                                        <td className="px-4 py-3 text-sm text-[var(--rs-text)]">{toNumber(item.latitude).toFixed(4)}, {toNumber(item.longitude).toFixed(4)}</td>
                                        <td className="px-4 py-3 text-sm text-[var(--rs-muted)]">{new Date(item.updated_at || item.created_at).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-sm text-[var(--rs-text)]">{(toNumber(item.confidence) * 100).toFixed(0)}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="rs-panel overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full rs-table">
                        <thead>
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--rs-muted)] uppercase tracking-wider">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--rs-muted)] uppercase tracking-wider">Location</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--rs-muted)] uppercase tracking-wider">Severity</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--rs-muted)] uppercase tracking-wider">Confidence</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--rs-muted)] uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--rs-muted)] uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--rs-muted)] uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--rs-border)]">
                            {anomalies.map((anomaly) => (
                                <tr key={anomaly.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${anomaly.type === 'POTHOLE' ? 'bg-rose-500/15 text-rose-300' : 'bg-amber-500/15 text-amber-300'}`}>
                                            {anomaly.type === 'POTHOLE' ? 'Pothole' : 'Speed Bump'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--rs-text)]">{toNumber(anomaly.latitude).toFixed(4)}, {toNumber(anomaly.longitude).toFixed(4)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--rs-text)]">{(toNumber(anomaly.severity) * 100).toFixed(0)}%</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--rs-text)]">{(toNumber(anomaly.confidence) * 100).toFixed(0)}%</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {anomaly.verified ? <span className="text-emerald-400 text-sm">Verified</span> : <span className="text-[var(--rs-muted)] text-sm">Pending</span>}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--rs-muted)]">{new Date(anomaly.created_at).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <div className="flex gap-2">
                                            {!anomaly.verified && (
                                                <button onClick={() => handleVerify(anomaly.id)} className="p-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors" title="Verify">
                                                    <CheckCircle size={16} className="text-white" />
                                                </button>
                                            )}
                                            <button onClick={() => handleDelete(anomaly.id)} className="p-2 bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors" title="Delete">
                                                <Trash2 size={16} className="text-white" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
