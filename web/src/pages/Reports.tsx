import { useEffect, useState } from 'react'
import { Wrench, AlertTriangle, TrafficCone, Clock4 } from 'lucide-react'
import LoaderBars from '../components/LoaderBars'
import { getRepairedSummary } from '../lib/queries'

type WindowDays = 7 | 30 | 90

type RepairedSummary = {
    total: number
    repairedTotal: number
    repairedPotholes: number
    repairedSpeedBumps: number
    repairedPercent: number
    pendingTotal: number
}

const WINDOW_OPTIONS: WindowDays[] = [7, 30, 90]

export default function Reports() {
    const [windowDays, setWindowDays] = useState<WindowDays>(30)
    const [summary, setSummary] = useState<RepairedSummary | null>(null)
    const [loading, setLoading] = useState(true)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    useEffect(() => {
        void loadSummary(windowDays)
    }, [windowDays])

    async function loadSummary(days: WindowDays) {
        try {
            setLoading(true)
            setErrorMessage(null)
            const data = await getRepairedSummary(days)
            setSummary(data)
        } catch (error) {
            console.error('Error loading repaired report summary:', error)
            setErrorMessage('Could not load repaired report right now.')
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <LoaderBars label="Loading repaired report..." />
            </div>
        )
    }

    if (!summary) {
        return (
            <div className="rs-panel p-6 text-[var(--rs-muted)]">
                {errorMessage || 'No repaired report data available yet.'}
            </div>
        )
    }

    return (
        <div className="space-y-6 rs-fade-up">
            <div className="rs-panel p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <p className="text-[var(--rs-muted)] text-xs uppercase tracking-[0.12em]">RoadSense Report</p>
                        <h2 className="text-3xl font-black text-[var(--rs-text)] mt-1">Repaired Road Overview</h2>
                        <p className="text-[var(--rs-muted)] mt-2">
                            See how many potholes and speed bumps were marked repaired in the selected time window.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-[var(--rs-muted)]">Window</span>
                        <select
                            className="rs-select w-auto min-w-[120px]"
                            value={windowDays}
                            onChange={(event) => setWindowDays(Number(event.target.value) as WindowDays)}
                        >
                            {WINDOW_OPTIONS.map((days) => (
                                <option key={days} value={days}>
                                    Last {days} days
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {errorMessage && (
                <div className="rounded-xl border border-[#7b3d3d] bg-[#3b2222] text-[#ffb7b7] px-4 py-3 text-sm">
                    {errorMessage}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <MetricCard
                    icon={Wrench}
                    colorClass="bg-emerald-500/15 text-emerald-300 border border-emerald-400/35"
                    label="Total Repaired"
                    value={summary.repairedTotal}
                />
                <MetricCard
                    icon={AlertTriangle}
                    colorClass="bg-rose-500/15 text-rose-300 border border-rose-400/35"
                    label="Repaired Potholes"
                    value={summary.repairedPotholes}
                />
                <MetricCard
                    icon={TrafficCone}
                    colorClass="bg-amber-500/15 text-amber-300 border border-amber-400/35"
                    label="Repaired Speed Bumps"
                    value={summary.repairedSpeedBumps}
                />
                <MetricCard
                    icon={Clock4}
                    colorClass="bg-cyan-500/15 text-cyan-300 border border-cyan-400/35"
                    label="Pending Repair"
                    value={summary.pendingTotal}
                />
            </div>

            <div className="rs-panel p-6">
                <h3 className="text-xl font-bold text-[var(--rs-text)]">Repair Rate</h3>
                <p className="text-[var(--rs-muted)] mt-1">
                    {summary.repairedTotal} out of {summary.total} anomalies were marked repaired in this window.
                </p>
                <div className="mt-5">
                    <div className="h-4 rounded-full bg-[rgba(53,84,124,0.28)] overflow-hidden border border-[var(--rs-border)]">
                        <div
                            className="h-full bg-[linear-gradient(90deg,#19d48f,#4cc9f0)]"
                            style={{ width: `${Math.max(0, Math.min(100, summary.repairedPercent))}%` }}
                        />
                    </div>
                    <p className="mt-3 text-sm text-[var(--rs-text)] font-semibold">
                        Repaired: {summary.repairedPercent.toFixed(1)}%
                    </p>
                </div>
            </div>
        </div>
    )
}

function MetricCard({
    icon: Icon,
    label,
    value,
    colorClass,
}: {
    icon: any
    label: string
    value: number
    colorClass: string
}) {
    return (
        <div className="rs-panel p-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-[var(--rs-muted)] text-sm">{label}</p>
                    <p className="text-3xl font-bold text-[var(--rs-text)] mt-1">{value}</p>
                </div>
                <div className={`p-3 rounded-xl ${colorClass}`}>
                    <Icon size={22} />
                </div>
            </div>
        </div>
    )
}
