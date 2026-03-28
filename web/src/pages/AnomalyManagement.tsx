import { useEffect, useState } from 'react'
import { getAllAnomalies, verifyAnomaly, deleteAnomaly } from '../lib/queries'
import { Anomaly } from '../lib/supabase'
import { CheckCircle, Trash2, Filter } from 'lucide-react'
import LoaderBars from '../components/LoaderBars'

export default function AnomalyManagement() {
    const [anomalies, setAnomalies] = useState<Anomaly[]>([])
    const [loading, setLoading] = useState(true)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [filter, setFilter] = useState<'all' | 'POTHOLE' | 'SPEED_BUMP'>('all')
    const [verifiedFilter, setVerifiedFilter] = useState<'all' | 'repaired' | 'not_repaired'>('all')

    useEffect(() => {
        loadAnomalies()
    }, [filter, verifiedFilter])

    async function loadAnomalies() {
        try {
            setErrorMessage(null)
            const filters: any = {}
            if (filter !== 'all') filters.type = filter
            if (verifiedFilter === 'repaired') filters.verified = true
            if (verifiedFilter === 'not_repaired') filters.verified = false

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
            loadAnomalies()
        } catch (error) {
            console.error('Error verifying anomaly:', error)
            alert('Failed to verify anomaly')
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Are you sure you want to delete this anomaly?')) return

        try {
            await deleteAnomaly(id)
            loadAnomalies()
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
                    </div>
                    <div className="ml-auto text-[var(--rs-muted)]">{anomalies.length} anomalies</div>
                </div>
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
