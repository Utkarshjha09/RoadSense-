import { useEffect, useState } from 'react'
import { getAnomalyStats, getAllAnomalies, getRepairValidationStats } from '../lib/queries'
import { Activity, MapPin } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { RepairValidationStat } from '../lib/supabase'
import { Link } from 'react-router-dom'
import LoaderBars from '../components/LoaderBars'
import {
    Card,
    Pill,
    StatCard,
    Legend,
    EmptyState,
    TONE_VAR,
    type Tone,
} from '../components/ui'

type RepairFilter = 'all' | 'repaired' | 'not_repaired' | 'waiting'

export default function Dashboard() {
    const [stats, setStats] = useState<any>(null)
    const [recentAnomalies, setRecentAnomalies] = useState<any[]>([])
    const [repairStats, setRepairStats] = useState<RepairValidationStat[]>([])
    const [repairFilter, setRepairFilter] = useState<RepairFilter>('all')
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
            <div className="flex items-center justify-center min-h-[60vh]">
                <LoaderBars label="Loading dashboard" />
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
        { name: 'Potholes', value: stats?.potholes || 0, tone: 'danger' as Tone },
        { name: 'Speed Bumps', value: stats?.speedBumps || 0, tone: 'warn' as Tone },
    ]
    const chartTotal = chartData.reduce((sum, entry) => sum + entry.value, 0)

    return (
        <div className="space-y-5 rs-fade-up">
            {/* Detection counts. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard label="Total Anomalies" value={stats?.total ?? 0} caption="All time detections" />
                <StatCard label="Potholes" value={stats?.potholes ?? 0} caption="Active issues" />
                <StatCard label="Speed Bumps" value={stats?.speedBumps ?? 0} caption="Detected" />
                <StatCard
                    label="Verified"
                    value={`${stats?.verificationRate?.toFixed(0) ?? 0}%`}
                    caption="Of total detections"
                />
            </div>

            {/* Repair validation counts. */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard label="Repairs Completed" value={repairedCount} caption="Confirmed by later passes" />
                <StatCard label="Repairs Remaining" value={remainingCount} caption="Still reporting issues" />
                <StatCard label="Under Observation" value={waitingCount} caption="Awaiting enough passes" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
                <Card className="p-5">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <h2 className="rs-heading">Anomaly Distribution</h2>
                        <Legend items={[{ label: 'Potholes', tone: 'danger' }, { label: 'Bumps', tone: 'warn' }]} />
                    </div>

                    {chartTotal === 0 ? (
                        <EmptyState
                            icon={Activity}
                            title="No detections yet"
                            description="Data appears once drives are logged."
                        />
                    ) : (
                        <>
                            <ResponsiveContainer width="100%" height={240}>
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={62}
                                        outerRadius={94}
                                        paddingAngle={3}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {chartData.map((entry) => (
                                            <Cell key={entry.name} fill={TONE_VAR[entry.tone]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            background: 'var(--rs-surface-2)',
                                            border: '1px solid var(--rs-line)',
                                            borderRadius: 8,
                                            fontSize: 13,
                                        }}
                                        itemStyle={{ color: 'var(--rs-text)' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>

                            <div className="flex items-center justify-center gap-10 mt-2">
                                {chartData.map((entry) => (
                                    <div key={entry.name} className="text-center">
                                        <p className="rs-metric-sm" style={{ color: TONE_VAR[entry.tone] }}>
                                            {chartTotal ? Math.round((entry.value / chartTotal) * 100) : 0}%
                                        </p>
                                        <p className="rs-micro mt-1">{entry.name}</p>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </Card>

                <Card className="p-5 flex flex-col">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="rs-heading">Recent Detections</h2>
                        <Link to="/anomalies" className="rs-link text-[13px]">
                            View all
                        </Link>
                    </div>

                    {recentAnomalies.length === 0 ? (
                        <EmptyState
                            icon={Activity}
                            title="Nothing logged yet"
                            description="Detections stream in from active drives."
                        />
                    ) : (
                        <div className="-mx-5 mt-2 max-h-[20rem] overflow-y-auto">
                            {recentAnomalies.map((anomaly, index) => {
                                const isPothole = anomaly.type === 'POTHOLE'
                                return (
                                    <div
                                        key={anomaly.id}
                                        className={`flex items-center justify-between gap-3 px-5 py-3 ${
                                            index > 0 ? 'border-t border-[var(--rs-line)]' : ''
                                        }`}
                                    >
                                        <div className="min-w-0">
                                            <p className="text-[14px] font-medium text-[var(--rs-text)]">
                                                {isPothole ? 'Pothole' : 'Speed Bump'}
                                            </p>
                                            <p className="text-[13px] text-[var(--rs-text-faint)]">
                                                {new Date(anomaly.created_at).toLocaleDateString()}
                                                {' - '}
                                                {(anomaly.severity * 100).toFixed(0)}% severity
                                            </p>
                                        </div>
                                        <Pill tone={anomaly.verified ? 'success' : 'warn'}>
                                            {anomaly.verified ? 'Verified' : 'Pending'}
                                        </Pill>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </Card>
            </div>

            {/* Repair validation detail. */}
            <Card className="overflow-hidden">
                <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--rs-line)]">
                    <div>
                        <h2 className="rs-heading">Repair Validation</h2>
                        <p className="text-[13px] text-[var(--rs-text-faint)] mt-0.5">
                            Locations tracked across repeated passes
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={repairFilter}
                            onChange={(event) => setRepairFilter(event.target.value as RepairFilter)}
                            className="rs-select w-auto min-w-[9rem] py-2 text-[14px]"
                            aria-label="Filter by repair status"
                        >
                            <option value="all">All status</option>
                            <option value="repaired">Repaired</option>
                            <option value="not_repaired">Not repaired</option>
                            <option value="waiting">Waiting data</option>
                        </select>
                        <Pill tone="neutral">{filteredRepairStats.length} results</Pill>
                    </div>
                </div>

                <div className="overflow-x-auto max-h-[26rem]">
                    <table className="rs-table min-w-[54rem]">
                        <thead>
                            <tr>
                                <th>Location</th>
                                <th>Address</th>
                                <th>Potholes</th>
                                <th>Bumps</th>
                                <th>Observed</th>
                                <th>Repaired</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRepairStats.map((item) => {
                                const mapUrl = `/map?lat=${item.latitude}&lng=${item.longitude}&zoom=17`
                                const status = STATUS_META[item.status_label] ?? STATUS_META.WAITING_DATA

                                return (
                                    <tr key={item.repair_id}>
                                        <td className="whitespace-nowrap">
                                            <Link className="rs-link rs-mono text-[12px]" to={mapUrl}>
                                                {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
                                            </Link>
                                        </td>
                                        <td className="max-w-[16rem]">
                                            {item.address_text ? (
                                                <Link className="rs-link" to={mapUrl}>
                                                    {item.address_text}
                                                </Link>
                                            ) : (
                                                <span className="rs-faint">Not set</span>
                                            )}
                                        </td>
                                        <td className="rs-mono text-[var(--rs-danger)]">{item.pothole_events}</td>
                                        <td className="rs-mono text-[var(--rs-warn)]">{item.speed_bump_events}</td>
                                        <td className="rs-mono rs-muted">
                                            {item.observed_events}/{item.sample_goal}
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-2 min-w-[7rem]">
                                                <div className="flex-1 h-1.5 rounded-full bg-[var(--rs-surface-3)] overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full"
                                                        style={{
                                                            width: `${Math.min(100, Math.max(0, item.repaired_percent))}%`,
                                                            background: 'var(--rs-success)',
                                                        }}
                                                    />
                                                </div>
                                                <span className="rs-mono text-[12px] rs-faint w-9 text-right">
                                                    {item.repaired_percent.toFixed(0)}%
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <Pill tone={status.tone}>{status.label}</Pill>
                                        </td>
                                    </tr>
                                )
                            })}
                            {filteredRepairStats.length === 0 && (
                                <tr>
                                    <td colSpan={7}>
                                        <EmptyState icon={MapPin} title="No locations match" description="Try a different status filter." />
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

const STATUS_META: Record<string, { label: string; tone: Tone }> = {
    REPAIRED: { label: 'Repaired', tone: 'success' },
    REMAINING_ISSUES: { label: 'Remaining', tone: 'danger' },
    WAITING_DATA: { label: 'Waiting', tone: 'warn' },
}
