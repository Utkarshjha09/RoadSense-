import { useEffect, useState } from 'react'
import { getAnomalyStats, getAllAnomalies, getRepairValidationStats } from '../lib/queries'
import { AlertTriangle, CheckCircle, TrendingUp, MapPin } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { RepairValidationStat } from '../lib/supabase'
import { Link } from 'react-router-dom'
import LoaderBars from '../components/LoaderBars'

export default function Dashboard() {
    const [stats, setStats] = useState<any>(null)
    const [recentAnomalies, setRecentAnomalies] = useState<any[]>([])
    const [repairStats, setRepairStats] = useState<RepairValidationStat[]>([])
    const [repairFilter, setRepairFilter] = useState<'all' | 'repaired' | 'not_repaired' | 'waiting'>('all')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        try {
            const [statsData, anomaliesData, repairStatsData] = await Promise.all([
                getAnomalyStats(),
                getAllAnomalies({ limit: 10 }),
                getRepairValidationStats(50),
            ])
            setStats(statsData)
            setRecentAnomalies(anomaliesData)
            setRepairStats(repairStatsData)
        } catch (error) {
            console.error('Error loading dashboard data:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <LoaderBars label="Loading dashboard..." />
            </div>
        )
    }

    const repairedCount = repairStats.filter((item) => item.status_label === 'REPAIRED').length
    const remainingCount = repairStats.filter((item) => item.status_label === 'REMAINING_ISSUES').length
    const waitingCount = repairStats.filter((item) => item.status_label === 'WAITING_DATA').length
    const filteredRepairStats = repairStats.filter((item) => {
        if (repairFilter === 'repaired') return item.status_label === 'REPAIRED'
        if (repairFilter === 'not_repaired') return item.status_label === 'REMAINING_ISSUES'
        if (repairFilter === 'waiting') return item.status_label === 'WAITING_DATA'
        return true
    })

    const chartData = [
        { name: 'Potholes', value: stats?.potholes || 0, color: '#ff6b5f' },
        { name: 'Speed Bumps', value: stats?.speedBumps || 0, color: '#f9a826' },
    ]

    return (
        <div className="space-y-6 rs-fade-up">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard icon={MapPin} label="Total Anomalies" value={stats?.total || 0} color="blue" />
                <StatsCard icon={AlertTriangle} label="Potholes" value={stats?.potholes || 0} color="red" />
                <StatsCard icon={TrendingUp} label="Speed Bumps" value={stats?.speedBumps || 0} color="yellow" />
                <StatsCard icon={CheckCircle} label="Verified" value={`${stats?.verificationRate?.toFixed(1) || 0}%`} color="green" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="rs-panel p-5">
                    <p className="text-[var(--rs-muted)] text-xs uppercase tracking-[0.12em]">Repairs Completed</p>
                    <p className="text-3xl font-bold text-emerald-300 mt-2">{repairedCount}</p>
                </div>
                <div className="rs-panel p-5">
                    <p className="text-[var(--rs-muted)] text-xs uppercase tracking-[0.12em]">Repairs Remaining</p>
                    <p className="text-3xl font-bold text-rose-300 mt-2">{remainingCount}</p>
                </div>
                <div className="rs-panel p-5">
                    <p className="text-[var(--rs-muted)] text-xs uppercase tracking-[0.12em]">Under Observation</p>
                    <p className="text-3xl font-bold text-amber-300 mt-2">{waitingCount}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rs-panel p-6">
                    <h3 className="text-lg font-semibold text-[var(--rs-text)] mb-4">Anomaly Distribution</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                outerRadius={84}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                <div className="rs-panel p-6">
                    <h3 className="text-lg font-semibold text-[var(--rs-text)] mb-4">Recent Detections</h3>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                        {recentAnomalies.map((anomaly) => (
                            <div key={anomaly.id} className="flex items-center justify-between p-3 rs-panel-soft">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2.5 h-2.5 rounded-full ${anomaly.type === 'POTHOLE' ? 'bg-[#ff6b5f]' : 'bg-[#f9a826]'}`} />
                                    <div>
                                        <p className="text-[var(--rs-text)] font-medium">{anomaly.type === 'POTHOLE' ? 'Pothole' : 'Speed Bump'}</p>
                                        <p className="text-[var(--rs-muted)] text-sm">{new Date(anomaly.created_at).toLocaleString()}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[var(--rs-text)] text-sm">{(anomaly.severity * 100).toFixed(0)}% severity</p>
                                    {anomaly.verified && <span className="text-emerald-400 text-xs">Verified</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="rs-panel overflow-hidden">
                <div className="px-6 pt-5 pb-3 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-[var(--rs-text)]">Repair Validation </h3>
                    <div className="flex items-center gap-3">
                        <select
                            value={repairFilter}
                            onChange={(e) => setRepairFilter(e.target.value as 'all' | 'repaired' | 'not_repaired' | 'waiting')}
                            className="rs-select w-auto min-w-[170px] text-sm"
                        >
                            <option value="all">All Status</option>
                            <option value="repaired">Repaired</option>
                            <option value="not_repaired">Not Repaired</option>
                            <option value="waiting">Waiting Data</option>
                        </select>
                        <p className="text-sm text-[var(--rs-muted)]">{filteredRepairStats.length} locations</p>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full rs-table">
                        <thead>
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--rs-muted)] uppercase tracking-wider">Location</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--rs-muted)] uppercase tracking-wider">Address</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--rs-muted)] uppercase tracking-wider">Potholes</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--rs-muted)] uppercase tracking-wider">Speed Bumps</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--rs-muted)] uppercase tracking-wider">Observed/Goal</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--rs-muted)] uppercase tracking-wider">Repaired %</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--rs-muted)] uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--rs-border)]">
                            {filteredRepairStats.map((item) => {
                                const mapUrl = `/map?lat=${item.latitude}&lng=${item.longitude}&zoom=17`
                                return (
                                    <tr key={item.repair_id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <Link className="text-cyan-300 hover:text-cyan-200 underline" to={mapUrl}>
                                                {item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}
                                            </Link>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-[var(--rs-text)]">
                                            {item.address_text ? (
                                                <Link className="text-cyan-300 hover:text-cyan-200 underline" to={mapUrl}>
                                                    {item.address_text}
                                                </Link>
                                            ) : (
                                                <span className="text-[var(--rs-muted)]">Address not set</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-rose-300">{item.pothole_events}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-amber-300">{item.speed_bump_events}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--rs-text)]">{item.observed_events}/{item.sample_goal}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--rs-text)]">{item.repaired_percent.toFixed(1)}%</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            {item.status_label === 'REPAIRED' && <span className="text-emerald-300">Repaired</span>}
                                            {item.status_label === 'REMAINING_ISSUES' && <span className="text-rose-300">Remaining</span>}
                                            {item.status_label === 'WAITING_DATA' && <span className="text-amber-300">Waiting Data</span>}
                                        </td>
                                    </tr>
                                )
                            })}
                            {filteredRepairStats.length === 0 && (
                                <tr>
                                    <td className="px-6 py-6 text-sm text-[var(--rs-muted)]" colSpan={7}>
                                        No locations found for selected filter.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

function StatsCard({
    icon: Icon,
    label,
    value,
    color,
}: {
    icon: any
    label: string
    value: string | number
    color: string
}) {
    const colors = {
        blue: 'bg-cyan-500/15 text-cyan-300 border border-cyan-400/35',
        red: 'bg-rose-500/15 text-rose-300 border border-rose-400/35',
        yellow: 'bg-amber-500/15 text-amber-300 border border-amber-400/35',
        green: 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/35',
    }

    return (
        <div className="rs-panel p-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-[var(--rs-muted)] text-sm mb-1">{label}</p>
                    <p className="text-3xl font-bold text-[var(--rs-text)]">{value}</p>
                </div>
                <div className={`p-3 rounded-xl ${colors[color as keyof typeof colors]}`}>
                    <Icon size={24} />
                </div>
            </div>
        </div>
    )
}
