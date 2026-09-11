import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import LoaderBars from '../components/LoaderBars'
import { getRepairedSummary } from '../lib/queries'
import { Card, Pill, StatCard, EmptyState } from '../components/ui'

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
            setErrorMessage('Could not load repair report. Database connection required.')
            setSummary(null)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <LoaderBars label="Loading report" />
            </div>
        )
    }

    const repairedPercent = summary ? Math.max(0, Math.min(100, summary.repairedPercent)) : 0

    return (
        <div className="space-y-5 rs-fade-up">
            {errorMessage && <div className="rs-banner rs-banner-warn">{errorMessage}</div>}

            {/* Headline figures. A failed load shows dashes, never zeros. */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                    label="Total Repaired"
                    value={summary ? summary.repairedTotal : null}
                    caption={`Last ${windowDays} days`}
                />
                <StatCard
                    label="Still Pending"
                    value={summary ? summary.pendingTotal : null}
                    caption="Awaiting repair"
                />
                <StatCard
                    label="Repair Rate"
                    value={summary ? `${repairedPercent.toFixed(1)}%` : null}
                    caption="Share of detections closed"
                />
            </div>

            <Card className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                    <div>
                        <h2 className="rs-heading">Repair Breakdown</h2>
                        <p className="text-[13px] text-[var(--rs-text-faint)] mt-0.5">
                            Potholes and speed bumps marked repaired in this window
                        </p>
                    </div>
                    <select
                        className="rs-select w-auto min-w-[9.5rem] py-2 text-[14px]"
                        value={windowDays}
                        onChange={(event) => setWindowDays(Number(event.target.value) as WindowDays)}
                        aria-label="Report window"
                    >
                        {WINDOW_OPTIONS.map((days) => (
                            <option key={days} value={days}>
                                Last {days} days
                            </option>
                        ))}
                    </select>
                </div>

                {!summary ? (
                    <EmptyState
                        icon={AlertTriangle}
                        title="No report data"
                        description="Connect the database to see live repair trends."
                    />
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                            <div className="rs-panel-soft bg-[var(--rs-surface-2)] px-4 py-3.5">
                                <p className="rs-stat-label">Potholes repaired</p>
                                <p className="rs-metric-sm text-[var(--rs-danger)] mt-1.5">
                                    {summary.repairedPotholes}
                                </p>
                            </div>
                            <div className="rs-panel-soft bg-[var(--rs-surface-2)] px-4 py-3.5">
                                <p className="rs-stat-label">Speed bumps repaired</p>
                                <p className="rs-metric-sm text-[var(--rs-warn)] mt-1.5">
                                    {summary.repairedSpeedBumps}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 mb-2">
                            <p className="text-[14px] text-[var(--rs-text-muted)]">
                                {summary.repairedTotal} of {summary.total} anomalies closed
                            </p>
                            <Pill tone={repairedPercent >= 50 ? 'success' : 'warn'}>
                                {repairedPercent.toFixed(1)}%
                            </Pill>
                        </div>

                        <div className="h-2 rounded-full bg-[var(--rs-surface-3)] overflow-hidden">
                            <div
                                className="h-full rounded-full transition-[width] duration-500 ease-out"
                                style={{
                                    width: `${repairedPercent}%`,
                                    background: 'var(--rs-success)',
                                }}
                            />
                        </div>
                        <div className="flex items-center justify-between mt-2">
                            <span className="rs-micro">0%</span>
                            <span className="rs-micro">100%</span>
                        </div>
                    </>
                )}
            </Card>
        </div>
    )
}
