import { useEffect, useState } from 'react'
import { getAllAnomalies, verifyAnomaly, deleteAnomaly } from '../lib/queries'
import { Anomaly } from '../lib/supabase'
import { CheckCircle, Trash2, Filter } from 'lucide-react'

export default function AnomalyManagement() {
    const [anomalies, setAnomalies] = useState<Anomaly[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'all' | 'POTHOLE' | 'SPEED_BUMP'>('all')
    const [verifiedFilter, setVerifiedFilter] = useState<'all' | 'verified' | 'unverified'>('all')

    useEffect(() => {
        loadAnomalies()
    }, [filter, verifiedFilter])

    async function loadAnomalies() {
        try {
            const filters: any = {}
            if (filter !== 'all') filters.type = filter
            if (verifiedFilter === 'verified') filters.verified = true
            if (verifiedFilter === 'unverified') filters.verified = false

            const data = await getAllAnomalies(filters)
            setAnomalies(data)
        } catch (error) {
            console.error('Error loading anomalies:', error)
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
                <div className="text-white text-xl">Loading...</div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                <div className="flex items-center gap-4">
                    <Filter className="text-slate-400" size={20} />
                    <div className="flex gap-4">
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value as any)}
                            className="bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600"
                        >
                            <option value="all">All Types</option>
                            <option value="POTHOLE">Potholes</option>
                            <option value="SPEED_BUMP">Speed Bumps</option>
                        </select>

                        <select
                            value={verifiedFilter}
                            onChange={(e) => setVerifiedFilter(e.target.value as any)}
                            className="bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600"
                        >
                            <option value="all">All Status</option>
                            <option value="verified">Verified</option>
                            <option value="unverified">Unverified</option>
                        </select>
                    </div>
                    <div className="ml-auto text-slate-400">
                        {anomalies.length} anomalies
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                                    Type
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                                    Location
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                                    Severity
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                                    Confidence
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                                    Date
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {anomalies.map((anomaly) => (
                                <tr key={anomaly.id} className="hover:bg-slate-700/50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span
                                            className={`px-2 py-1 rounded-full text-xs font-medium ${anomaly.type === 'POTHOLE'
                                                    ? 'bg-red-500/20 text-red-400'
                                                    : 'bg-yellow-500/20 text-yellow-400'
                                                }`}
                                        >
                                            {anomaly.type === 'POTHOLE' ? '🕳️ Pothole' : '🚧 Speed Bump'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                                        {anomaly.latitude.toFixed(4)}, {anomaly.longitude.toFixed(4)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                                        {(anomaly.severity * 100).toFixed(0)}%
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                                        {(anomaly.confidence * 100).toFixed(0)}%
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {anomaly.verified ? (
                                            <span className="text-green-400 text-sm">✓ Verified</span>
                                        ) : (
                                            <span className="text-slate-400 text-sm">⏳ Pending</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                                        {new Date(anomaly.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <div className="flex gap-2">
                                            {!anomaly.verified && (
                                                <button
                                                    onClick={() => handleVerify(anomaly.id)}
                                                    className="p-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                                                    title="Verify"
                                                >
                                                    <CheckCircle size={16} className="text-white" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(anomaly.id)}
                                                className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                                                title="Delete"
                                            >
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
