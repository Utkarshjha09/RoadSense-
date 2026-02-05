import { useEffect, useState } from 'react'
import { getAnomalyStats, getAllAnomalies } from '../lib/queries'
import { AlertTriangle, CheckCircle, TrendingUp, MapPin } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

export default function Dashboard() {
    const [stats, setStats] = useState<any>(null)
    const [recentAnomalies, setRecentAnomalies] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        try {
            const [statsData, anomaliesData] = await Promise.all([
                getAnomalyStats(),
                getAllAnomalies({ limit: 10 }),
            ])
            setStats(statsData)
            setRecentAnomalies(anomaliesData)
        } catch (error) {
            console.error('Error loading dashboard data:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-white text-xl">Loading...</div>
            </div>
        )
    }

    const chartData = [
        { name: 'Potholes', value: stats?.potholes || 0, color: '#ef4444' },
        { name: 'Speed Bumps', value: stats?.speedBumps || 0, color: '#f59e0b' },
    ]

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard
                    icon={MapPin}
                    label="Total Anomalies"
                    value={stats?.total || 0}
                    color="blue"
                />
                <StatsCard
                    icon={AlertTriangle}
                    label="Potholes"
                    value={stats?.potholes || 0}
                    color="red"
                />
                <StatsCard
                    icon={TrendingUp}
                    label="Speed Bumps"
                    value={stats?.speedBumps || 0}
                    color="yellow"
                />
                <StatsCard
                    icon={CheckCircle}
                    label="Verified"
                    value={`${stats?.verificationRate?.toFixed(1) || 0}%`}
                    color="green"
                />
            </div>

            {/* Charts and Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Type Distribution Chart */}
                <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Anomaly Distribution</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                outerRadius={80}
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

                {/* Recent Detections */}
                <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Recent Detections</h3>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                        {recentAnomalies.map((anomaly) => (
                            <div
                                key={anomaly.id}
                                className="flex items-center justify-between p-3 bg-slate-700 rounded-lg"
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className={`w-2 h-2 rounded-full ${anomaly.type === 'POTHOLE' ? 'bg-red-500' : 'bg-yellow-500'
                                            }`}
                                    />
                                    <div>
                                        <p className="text-white font-medium">
                                            {anomaly.type === 'POTHOLE' ? '🕳️ Pothole' : '🚧 Speed Bump'}
                                        </p>
                                        <p className="text-slate-400 text-sm">
                                            {new Date(anomaly.created_at).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-white text-sm">
                                        {(anomaly.severity * 100).toFixed(0)}% severity
                                    </p>
                                    {anomaly.verified && (
                                        <span className="text-green-500 text-xs">✓ Verified</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
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
        blue: 'bg-blue-500/10 text-blue-500',
        red: 'bg-red-500/10 text-red-500',
        yellow: 'bg-yellow-500/10 text-yellow-500',
        green: 'bg-green-500/10 text-green-500',
    }

    return (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-slate-400 text-sm mb-1">{label}</p>
                    <p className="text-3xl font-bold text-white">{value}</p>
                </div>
                <div className={`p-3 rounded-lg ${colors[color as keyof typeof colors]}`}>
                    <Icon size={24} />
                </div>
            </div>
        </div>
    )
}
