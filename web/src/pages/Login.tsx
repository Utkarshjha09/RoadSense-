import { useMemo, useState } from 'react'
import { Eye, EyeOff, MailCheck } from 'lucide-react'
import { useAuth } from '../components/AuthProvider'
import { useNavigate } from 'react-router-dom'
import { sendOtp, verifyOtp } from '../lib/otp'

export default function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [otp, setOtp] = useState('')
    const [loading, setLoading] = useState(false)
    const [googleLoading, setGoogleLoading] = useState(false)
    const [otpLoading, setOtpLoading] = useState(false)
    const [resendLoading, setResendLoading] = useState(false)
    const [resetLoading, setResetLoading] = useState(false)
    const [error, setError] = useState('')
    const [otpMessage, setOtpMessage] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const {
        user,
        signIn,
        signInWithGoogle,
        sendPasswordResetEmail,
        bypassAuth,
        requiresLoginOtpVerification,
        markLoginOtpVerified,
    } = useAuth()
    const navigate = useNavigate()

    const loginEmail = useMemo(() => {
        return (user?.email || email).trim().toLowerCase()
    }, [email, user?.email])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError('')
        setOtpMessage('')

        try {
            await signIn(email, password)
            await sendOtp(email.trim().toLowerCase(), 'login')
            setOtpMessage('OTP sent to your email. Enter it to complete login.')
            setOtp('')
        } catch (err: any) {
            setError(err.message || 'Failed to sign in')
        } finally {
            setLoading(false)
        }
    }

    async function handleGoogleSignIn() {
        setGoogleLoading(true)
        setError('')

        try {
            await signInWithGoogle()
        } catch (err: any) {
            setError(err.message || 'Failed to sign in with Google')
            setGoogleLoading(false)
        }
    }

    async function handleVerifyOtp(e: React.FormEvent) {
        e.preventDefault()
        setOtpLoading(true)
        setError('')

        try {
            await verifyOtp(loginEmail, otp.trim(), 'login')
            markLoginOtpVerified()
            navigate('/')
        } catch (err: any) {
            setError(err.message || 'Failed to verify OTP')
        } finally {
            setOtpLoading(false)
        }
    }

    async function handleResendOtp() {
        setResendLoading(true)
        setError('')

        try {
            await sendOtp(loginEmail, 'login')
            setOtpMessage('A fresh OTP has been sent to your email.')
        } catch (err: any) {
            setError(err.message || 'Failed to resend OTP')
        } finally {
            setResendLoading(false)
        }
    }

    async function handleForgotPassword() {
        const targetEmail = email.trim().toLowerCase()

        if (!targetEmail) {
            setError('Enter your email first, then use Forgot password.')
            return
        }

        setResetLoading(true)
        setError('')
        setOtpMessage('')

        try {
            await sendPasswordResetEmail(targetEmail)
            setOtpMessage('Password reset email sent. Open the link from your inbox, then set a new password on the profile page.')
        } catch (err: any) {
            setError(err.message || 'Failed to send password reset email')
        } finally {
            setResetLoading(false)
        }
    }

    const showOtpPanel = requiresLoginOtpVerification

    return (
        <div className="min-h-screen rs-grid-bg flex items-center justify-center p-4 md:p-8">
            <div className="rs-panel rs-fade-up p-8 md:p-10 w-full max-w-md">
                <div className="text-center mb-8">
                    <span className="rs-chip mb-4">Fleet Intelligence</span>
                    <h1 className="text-4xl text-[var(--rs-text)] mb-2">RoadSense Admin</h1>
                    <p className="text-[var(--rs-muted)]">
                        {showOtpPanel
                            ? 'Verify the OTP sent to your email to complete password login'
                            : 'Sign in to access live anomaly operations and your profile'}
                    </p>
                </div>

                {error && (
                    <div className="bg-[rgba(255,107,95,0.12)] border border-[rgba(255,107,95,0.5)] text-[#ffb2ab] px-4 py-3 rounded-xl mb-6">
                        {error}
                    </div>
                )}

                {otpMessage && (
                    <div className="bg-[rgba(31,186,129,0.12)] border border-[rgba(31,186,129,0.4)] text-[#a7f0d1] px-4 py-3 rounded-xl mb-6">
                        {otpMessage}
                    </div>
                )}

                {showOtpPanel ? (
                    <form onSubmit={handleVerifyOtp} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-[var(--rs-muted)] mb-2">
                                Email
                            </label>
                            <input
                                type="email"
                                value={loginEmail}
                                readOnly
                                className="rs-input opacity-70 cursor-not-allowed"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[var(--rs-muted)] mb-2">
                                OTP
                            </label>
                            <input
                                type="text"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                className="rs-input"
                                placeholder="Enter 6-digit OTP"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={otpLoading}
                            className="w-full rs-button-primary disabled:opacity-60 disabled:cursor-not-allowed py-3 px-4 inline-flex items-center justify-center gap-2"
                        >
                            <MailCheck size={18} />
                            {otpLoading ? 'Verifying OTP...' : 'Verify OTP'}
                        </button>

                        <button
                            type="button"
                            onClick={() => void handleResendOtp()}
                            disabled={resendLoading}
                            className="w-full rs-button-secondary py-3 px-4 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {resendLoading ? 'Sending...' : 'Resend OTP'}
                        </button>
                    </form>
                ) : (
                    <>
                        <div className="space-y-3 mb-6">
                            <button
                                type="button"
                                onClick={() => void handleGoogleSignIn()}
                                disabled={googleLoading}
                                className="w-full rs-button-secondary py-3 px-4 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {googleLoading ? 'Redirecting to Google...' : 'Continue with Google'}
                            </button>
                            <p className="text-center text-[var(--rs-muted)] text-xs">
                                Configure Google in Supabase Auth and add your site URL to allowed redirect URLs.
                            </p>
                        </div>

                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-[var(--rs-border)]" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-[var(--rs-panel)] px-3 text-[var(--rs-muted)]">or use email</span>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-[var(--rs-muted)] mb-2">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="rs-input"
                                    placeholder="admin@roadsense.com"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--rs-muted)] mb-2">
                                    Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="rs-input pr-12"
                                        placeholder="********"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((value) => !value)}
                                        className="absolute inset-y-0 right-0 px-4 text-[var(--rs-muted)] hover:text-[var(--rs-text)]"
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                <div className="mt-2 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => void handleForgotPassword()}
                                        disabled={resetLoading}
                                        className="text-sm text-[#7fd7ff] hover:text-white disabled:opacity-60"
                                    >
                                        {resetLoading ? 'Sending reset link...' : 'Forgot password?'}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full rs-button-primary disabled:opacity-60 disabled:cursor-not-allowed py-3 px-4"
                            >
                                {loading ? 'Signing in...' : 'Sign In'}
                            </button>
                        </form>

                        <div className="mt-6 pt-6 border-t border-[var(--rs-border)]">
                            <button
                                onClick={() => {
                                    bypassAuth()
                                    setTimeout(() => {
                                        navigate('/')
                                    }, 100)
                                }}
                                type="button"
                                className="w-full rs-button-secondary py-2.5 px-4 transition-colors text-sm"
                            >
                                Quick Login (Bypass Auth)
                            </button>
                            <p className="text-center text-[var(--rs-muted)] text-xs mt-2">
                                Testing mode: skips Supabase
                            </p>
                        </div>
                    </>
                )}

                <p className="text-center text-[var(--rs-muted)] text-sm mt-6">
                    Admin access required for dashboard modules
                </p>
            </div>
        </div>
    )
}
