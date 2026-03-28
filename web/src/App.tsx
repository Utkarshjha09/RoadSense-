import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './components/AuthProvider'
import Layout from './components/Layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import MapView from './pages/MapView'
import AnomalyManagement from './pages/AnomalyManagement'
import UserManagement from './pages/UserManagement'
import Profile from './pages/Profile'
import About from './pages/About'
import LoaderBars from './components/LoaderBars'
import './index.css'

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
                            <Route path="profile" element={<Profile />} />
                            <Route path="dashboard" element={<Dashboard />} />
                            <Route path="map" element={<MapView />} />
                            <Route path="anomalies" element={<AnomalyManagement />} />
                            <Route path="about" element={<About />} />
                            <Route path="anomaly" element={<Navigate to="/anomalies" replace />} />
                            <Route path="anomaly-management" element={<Navigate to="/anomalies" replace />} />
                            <Route
                                path="users"
                                element={
                                    <AdminRoute>
                                        <UserManagement />
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
