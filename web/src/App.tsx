import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './components/AuthProvider'
import Layout from './components/Layout/Layout'
import Login from './pages/Login'
import LoaderBars from './components/LoaderBars'
import './index.css'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const MapView = lazy(() => import('./pages/MapView'))
const AnomalyManagement = lazy(() => import('./pages/AnomalyManagement'))
const Reports = lazy(() => import('./pages/Reports'))
const UserManagement = lazy(() => import('./pages/UserManagement'))
const Profile = lazy(() => import('./pages/Profile'))
const About = lazy(() => import('./pages/About'))

const queryClient = new QueryClient()

function FullScreenMessage({ title, body }: { title: string; body: string }) {
    return (
        <div className="min-h-screen rs-grid-bg flex items-center justify-center p-4">
            <div className="rs-panel p-8 max-w-lg">
                <h2 className="text-2xl text-[var(--rs-text)] mb-4">{title}</h2>
                <p className="text-[var(--rs-muted)]">{body}</p>
            </div>
        </div>
    )
}

function AuthenticatedRoute({ children }: { children: React.ReactNode }) {
    const { user, loading, requiresLoginOtpVerification } = useAuth()

    if (loading) {
        return (
            <div className="min-h-screen rs-grid-bg flex items-center justify-center">
                <div className="rs-panel px-8 py-8 w-[320px]">
                    <LoaderBars label="Loading your session..." compact />
                </div>
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/login" replace />
    }

    if (requiresLoginOtpVerification) {
        return <Navigate to="/login" replace />
    }

    return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
    const { isAdmin } = useAuth()

    if (!isAdmin) {
        return (
            <FullScreenMessage
                title="Access Denied"
                body="Only admins can access user management."
            />
        )
    }

    return <>{children}</>
}

function HomeRedirect() {
    const { requiresPasswordSetup, requiresLoginOtpVerification } = useAuth()
    if (requiresLoginOtpVerification) {
        return <Navigate to="/login" replace />
    }
    return <Navigate to={requiresPasswordSetup ? '/profile' : '/dashboard'} replace />
}

function RouteLoader() {
    return (
        <div className="min-h-screen rs-grid-bg flex items-center justify-center">
            <div className="rs-panel px-8 py-8 w-[320px]">
                <LoaderBars label="Loading page..." compact />
            </div>
        </div>
    )
}

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <BrowserRouter>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route
                            path="/"
                            element={
                                <AuthenticatedRoute>
                                    <Layout />
                                </AuthenticatedRoute>
                            }
                        >
                            <Route index element={<HomeRedirect />} />
                            <Route
                                path="profile"
                                element={
                                    <Suspense fallback={<RouteLoader />}>
                                        <Profile />
                                    </Suspense>
                                }
                            />
                            <Route
                                path="dashboard"
                                element={
                                    <Suspense fallback={<RouteLoader />}>
                                        <Dashboard />
                                    </Suspense>
                                }
                            />
                            <Route
                                path="map"
                                element={
                                    <Suspense fallback={<RouteLoader />}>
                                        <MapView />
                                    </Suspense>
                                }
                            />
                            <Route
                                path="anomalies"
                                element={
                                    <Suspense fallback={<RouteLoader />}>
                                        <AnomalyManagement />
                                    </Suspense>
                                }
                            />
                            <Route
                                path="reports"
                                element={
                                    <Suspense fallback={<RouteLoader />}>
                                        <Reports />
                                    </Suspense>
                                }
                            />
                            <Route
                                path="about"
                                element={
                                    <Suspense fallback={<RouteLoader />}>
                                        <About />
                                    </Suspense>
                                }
                            />
                            <Route path="anomaly" element={<Navigate to="/anomalies" replace />} />
                            <Route path="anomaly-management" element={<Navigate to="/anomalies" replace />} />
                            <Route
                                path="users"
                                element={
                                    <AdminRoute>
                                        <Suspense fallback={<RouteLoader />}>
                                            <UserManagement />
                                        </Suspense>
                                    </AdminRoute>
                                }
                            />
                        </Route>
                    </Routes>
                </BrowserRouter>
            </AuthProvider>
        </QueryClientProvider>
    )
}

export default App
