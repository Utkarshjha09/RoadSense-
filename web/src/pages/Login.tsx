import { useMemo, useState } from 'react'
import { Eye, EyeOff, MailCheck, ArrowLeft } from 'lucide-react'
import { useAuth } from '../components/AuthProvider'
import { useNavigate } from 'react-router-dom'
import { sendOtp, verifyOtp } from '../lib/otp'
import { Button } from '../components/ui'

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
        signOut,
        signInWithGoogle,
        sendPasswordResetEmail,
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
            const otpCode = otp.replace(/\D/g, '').slice(0, 6)
            if (otpCode.length !== 6) {
                throw new Error('Enter a valid 6-digit OTP')
            }
            await verifyOtp(loginEmail, otpCode, 'login')
            markLoginOtpVerified()
            navigate('/')
        } catch (err: any) {
            setError(err.message || 'Failed to verify OTP')
        } finally {
            setOtpLoading(false)
        }
    }

    async function handleBackToLogin() {
        setError('')
        setOtp('')
        setOtpMessage('')
        try {
            await signOut()
        } catch {
            navigate('/login', { replace: true })
            window.location.reload()
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
        /* auth.tsx `container`: centered, padding 24, no card wrapper. */
        <div className="min-h-[100dvh] flex items-center justify-center p-6">
            <div className="w-full max-w-[26rem] rs-fade-up">
                {/* auth.tsx `brandRow`: icon tile + Road/Sense wordmark, centered. */}
                <div className="flex items-center justify-center gap-2 mb-7">
                    <span className="w-[30px] h-[30px] rounded-[10px] grid place-items-center bg-[var(--rs-primary-soft)] border border-[var(--rs-primary-edge)]">
                        <img src="/roadsense-icon.svg" alt="" className="w-4 h-4" />
                    </span>
                    <span className="text-[17px] font-semibold text-[var(--rs-text)]">
                        Road<span className="text-[var(--rs-primary)]">Sense</span>
                    </span>
                </div>

                {/* auth.tsx `title` / `subtitle`: left aligned, 32px display. */}
                <h1 className="rs-display">{showOtpPanel ? 'Verify' : 'Sign in'}</h1>
                <p className="text-sm text-[var(--rs-text-muted)] mt-1.5 mb-7">
                    {showOtpPanel
                        ? 'Enter the code we emailed you to finish signing in.'
                        : 'Welcome back. Your roads are waiting.'}
                </p>

                {error && <p className="text-[13px] text-[var(--rs-danger)] mb-3">{error}</p>}
                {otpMessage && <p className="text-[13px] text-[var(--rs-success)] mb-3">{otpMessage}</p>}

                {showOtpPanel ? (
                    <form onSubmit={handleVerifyOtp} className="flex flex-col gap-3.5">
                        <div>
                            <label htmlFor="otp-email" className="rs-label">Email</label>
                            <input
                                id="otp-email"
                                type="email"
                                value={loginEmail}
                                readOnly
                                className="rs-input opacity-70 cursor-not-allowed"
                            />
                        </div>

                        <div>
                            <label htmlFor="otp-code" className="rs-label">Verification code</label>
                            <input
                                id="otp-code"
                                type="text"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                /* auth.tsx `otpBox`: display font, wide tracking. */
                                className="rs-input text-[22px] font-semibold text-center tracking-[0.4em]"
                                placeholder="000000"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                maxLength={6}
                                required
                            />
                        </div>

                        <Button type="submit" icon={MailCheck} disabled={otpLoading} className="w-full mt-1">
                            {otpLoading ? 'Verifying...' : 'Verify Code'}
                        </Button>

                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => void handleResendOtp()}
                            disabled={resendLoading}
                            className="w-full"
                        >
                            {resendLoading ? 'Sending...' : 'Resend Code'}
                        </Button>

                        <button
                            type="button"
                            onClick={() => void handleBackToLogin()}
                            className="inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold text-[var(--rs-primary)] hover:opacity-80"
                        >
                            <ArrowLeft size={14} />
                            Back to login
                        </button>
                    </form>
                ) : (
                    <>
                        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
                            <div>
                                <label htmlFor="login-email" className="rs-label">Email</label>
                                <input
                                    id="login-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="rs-input"
                                    placeholder="you@example.com"
                                    autoComplete="email"
                                    required
                                />
                            </div>

                            <div>
                                <label htmlFor="login-password" className="rs-label">Password</label>
                                <div className="relative flex items-center">
                                    <input
                                        id="login-password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="rs-input pr-11"
                                        placeholder="********"
                                        autoComplete="current-password"
                                        required
                                    />
                                    {/* auth.tsx `eyeButton`: absolute, right 14. */}
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((value) => !value)}
                                        className="absolute right-[14px] p-1 text-[var(--rs-text-faint)] hover:text-[var(--rs-text)] transition-colors"
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                <div className="flex justify-end mt-1">
                                    <button
                                        type="button"
                                        onClick={() => void handleForgotPassword()}
                                        disabled={resetLoading}
                                        className="text-[13px] font-semibold text-[var(--rs-primary)] hover:opacity-80 disabled:opacity-60"
                                    >
                                        {resetLoading ? 'Sending reset link...' : 'Forgot password?'}
                                    </button>
                                </div>
                            </div>

                            <Button type="submit" disabled={loading} className="w-full mt-1">
                                {loading ? 'Signing in...' : 'Sign In'}
                            </Button>
                        </form>

                        {/* auth.tsx `divider`: hairline, 11px faint label, hairline. */}
                        <div className="flex items-center mt-4 mb-3.5">
                            <span className="flex-1 h-px bg-[var(--rs-line)]" />
                            <span className="px-2.5 text-[11px] text-[var(--rs-text-faint)]">or</span>
                            <span className="flex-1 h-px bg-[var(--rs-line)]" />
                        </div>

                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => void handleGoogleSignIn()}
                            disabled={googleLoading}
                            className="w-full"
                        >
                            {googleLoading ? 'Redirecting...' : 'Continue with Google'}
                        </Button>

                        {/* auth.tsx `switchText`. */}
                        <p className="text-center text-[13px] text-[var(--rs-text-muted)] mt-5">
                            Admin access required for dashboard modules
                        </p>
                    </>
                )}
            </div>
        </div>
    )
}
