import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { UserCircle2, Mail, Shield, Save, LockKeyhole, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../components/AuthProvider'
import { supabase } from '../lib/supabase'
import { sendOtp, verifyOtp } from '../lib/otp'

type EditableRole = 'driver' | 'owner'

export default function Profile() {
    const { user, profile, refreshProfile, requiresPasswordSetup, isGoogleUser, updatePassword } = useAuth()
    const [fullName, setFullName] = useState(profile?.full_name ?? '')
    const [email, setEmail] = useState(profile?.email ?? user?.email ?? '')
    const [role, setRole] = useState<EditableRole>(profile?.role === 'owner' ? 'owner' : 'driver')
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [passwordSaving, setPasswordSaving] = useState(false)
    const [otpSending, setOtpSending] = useState(false)
    const [passwordMessage, setPasswordMessage] = useState('')
    const [passwordError, setPasswordError] = useState('')
    const [passwordOtp, setPasswordOtp] = useState('')
    const [passwordOtpSent, setPasswordOtpSent] = useState(false)
    const [showPasswordPanel, setShowPasswordPanel] = useState(requiresPasswordSetup)
    const [showNewPassword, setShowNewPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const canSendPasswordOtp =
        password.trim().length >= 8 &&
        confirmPassword.trim().length >= 8 &&
        password === confirmPassword

    useEffect(() => {
        setFullName(profile?.full_name ?? '')
        setEmail(profile?.email ?? user?.email ?? '')
        setRole(profile?.role === 'owner' ? 'owner' : 'driver')
    }, [profile?.full_name, profile?.email, profile?.role, user?.email])

    useEffect(() => {
        if (requiresPasswordSetup) {
            setShowPasswordPanel(true)
        }
    }, [requiresPasswordSetup])

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()

        if (!user) {
            return
        }

        const nextFullName = fullName.trim() || null
        const nextEmail = email.trim().toLowerCase()
        const currentEmail = (profile?.email ?? user.email ?? '').trim().toLowerCase()
        const emailChanged = nextEmail.length > 0 && nextEmail !== currentEmail

        setSaving(true)
        setMessage('')
        setError('')

        try {
            if (emailChanged) {
                const { error: authError } = await supabase.auth.updateUser({
                    email: nextEmail,
                    data: {
                        full_name: nextFullName ?? '',
                    },
                })

                if (authError) {
                    throw authError
                }
            }

            const profileUpdate: { full_name: string | null; email?: string; role: EditableRole } = {
                full_name: nextFullName,
                role,
            }

            if (emailChanged) {
                profileUpdate.email = nextEmail
            }

            const { error: updateError } = await supabase
                .from('profiles')
                .update(profileUpdate)
                .eq('id', user.id)

            if (updateError) {
                throw updateError
            }

            await refreshProfile()
            setMessage(
                emailChanged
                    ? 'Profile updated. Check your inbox to confirm the new email address.'
                    : 'Profile updated successfully.'
            )
        } catch (err: any) {
            setError(err.message || 'Failed to update profile')
        } finally {
            setSaving(false)
        }
    }

    async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()

        if (password.length < 8) {
            setPasswordError('Password must be at least 8 characters long.')
            return
        }

        if (password !== confirmPassword) {
            setPasswordError('Passwords do not match.')
            return
        }

        setPasswordSaving(true)
        setPasswordError('')
        setPasswordMessage('')

        try {
            if (!passwordOtpSent) {
                throw new Error('Send OTP before updating your password.')
            }

            await verifyOtp((profile?.email ?? user?.email ?? '').trim().toLowerCase(), passwordOtp.trim(), 'password_change')
            await updatePassword(password)
            setPassword('')
            setConfirmPassword('')
            setPasswordOtp('')
            setPasswordOtpSent(false)
            setPasswordMessage('Password saved. You can now use email and password login too.')
        } catch (err: any) {
            setPasswordError(err.message || 'Failed to update password')
        } finally {
            setPasswordSaving(false)
        }
    }

    async function handleSendPasswordOtp() {
        const targetEmail = (profile?.email ?? user?.email ?? '').trim().toLowerCase()

        if (!targetEmail) {
            setPasswordError('No email found for this account.')
            return
        }

        if (!canSendPasswordOtp) {
            setPasswordError('Enter matching passwords with at least 8 characters before sending OTP.')
            return
        }

        setOtpSending(true)
        setPasswordError('')
        setPasswordMessage('')

        try {
            await sendOtp(targetEmail, 'password_change')
            setPasswordOtpSent(true)
            setPasswordMessage('OTP sent to your email. Verify it before updating the password.')
        } catch (err: any) {
            setPasswordError(err.message || 'Failed to send OTP')
        } finally {
            setOtpSending(false)
        }
    }

    return (
        <div className="space-y-6 rs-fade-up">
            {requiresPasswordSetup && (
                <div className="rounded-2xl border border-amber-400/35 bg-amber-500/10 px-5 py-4 text-amber-100">
                    <div className="flex items-start gap-3">
                        <LockKeyhole size={18} className="mt-1 shrink-0" />
                        <div>
                            <p className="font-semibold">Set a password to complete your first Google sign-in.</p>
                            <p className="text-sm mt-1 text-amber-50/85">
                                Once set, you can use either `Continue with Google` or your email and password on future logins.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.7fr] gap-6">
                <section className="space-y-6">
                    <div className="rs-panel p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-[linear-gradient(135deg,#255680,#4d94d3)] flex items-center justify-center">
                                <UserCircle2 className="text-white" size={24} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-[var(--rs-text)]">Edit Profile</h3>
                                <p className="text-[var(--rs-muted)]">
                                    Update your name, email, and whether this account represents a driver or vehicle owner.
                                </p>
                            </div>
                        </div>

                        {message && (
                            <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                                {message}
                            </div>
                        )}

                        {error && (
                            <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-[var(--rs-muted)] mb-2">
                                    Full Name
                                </label>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(event) => setFullName(event.target.value)}
                                    className="rs-input"
                                    placeholder="Enter your full name"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--rs-muted)] mb-2">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    className="rs-input"
                                    placeholder="Enter your email"
                                    required
                                />
                                <p className="text-xs text-[var(--rs-muted)] mt-2">
                                    If you change your email, Supabase may send a confirmation message to the new address.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--rs-muted)] mb-2">
                                    Account Role
                                </label>
                                <select
                                    value={role}
                                    onChange={(event) => setRole(event.target.value as EditableRole)}
                                    className="rs-select w-full"
                                >
                                    <option value="driver">Driver</option>
                                    <option value="owner">Owner</option>
                                </select>
                                <p className="text-xs text-[var(--rs-muted)] mt-2">
                                    `Owner` is for your own vehicle account. `Admin` remains restricted and cannot be self-assigned here.
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={saving}
                                className="rs-button-primary inline-flex items-center gap-2 px-5 py-3 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <Save size={18} />
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </form>
                    </div>

                    {!showPasswordPanel ? (
                        <div className="rs-panel p-6">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-[linear-gradient(135deg,#1f5b7b,#3c9fcf)] flex items-center justify-center">
                                        <LockKeyhole className="text-white" size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-[var(--rs-text)]">Password</h3>
                                        <p className="text-[var(--rs-muted)]">
                                            Change your password when needed.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowPasswordPanel(true)}
                                    className="rs-button-secondary inline-flex items-center gap-2 px-5 py-3"
                                >
                                    <LockKeyhole size={18} />
                                    Change Password
                                </button>
                            </div>
                        </div>
                    ) : (
                    <div className="rs-panel p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-[linear-gradient(135deg,#1f5b7b,#3c9fcf)] flex items-center justify-center">
                                <LockKeyhole className="text-white" size={24} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-[var(--rs-text)]">
                                    {requiresPasswordSetup ? 'Set Password' : 'Change Password'}
                                </h3>
                                <p className="text-[var(--rs-muted)]">
                                    {isGoogleUser
                                        ? 'Use this to enable email/password login in addition to Google.'
                                        : 'Update the password used for email/password sign-in.'}
                                </p>
                            </div>
                        </div>

                        {passwordMessage && (
                            <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                                {passwordMessage}
                            </div>
                        )}

                        {passwordError && (
                            <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                                {passwordError}
                            </div>
                        )}

                        <form onSubmit={handlePasswordSubmit} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-[var(--rs-muted)] mb-2">
                                    New Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showNewPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(event) => setPassword(event.target.value)}
                                        className="rs-input pr-12"
                                        placeholder="Enter a strong password"
                                        required
                                        minLength={8}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword((value) => !value)}
                                        className="absolute inset-y-0 right-0 px-4 text-[var(--rs-muted)] hover:text-[var(--rs-text)]"
                                        aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--rs-muted)] mb-2">
                                    Confirm Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(event) => setConfirmPassword(event.target.value)}
                                        className="rs-input pr-12"
                                        placeholder="Re-enter your password"
                                        required
                                        minLength={8}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword((value) => !value)}
                                        className="absolute inset-y-0 right-0 px-4 text-[var(--rs-muted)] hover:text-[var(--rs-text)]"
                                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--rs-muted)] mb-2">
                                    OTP
                                </label>
                                <input
                                    type="text"
                                    value={passwordOtp}
                                    onChange={(event) => setPasswordOtp(event.target.value)}
                                    className="rs-input"
                                    placeholder="Enter OTP sent to your email"
                                    required
                                />
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => void handleSendPasswordOtp()}
                                    disabled={otpSending || !canSendPasswordOtp}
                                    className="rs-button-secondary inline-flex items-center gap-2 px-5 py-3 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    <Mail size={18} />
                                    {otpSending ? 'Sending OTP...' : passwordOtpSent ? 'Resend OTP' : 'Send OTP'}
                                </button>
                                <button
                                    type="submit"
                                    disabled={passwordSaving}
                                    className="rs-button-secondary inline-flex items-center gap-2 px-5 py-3 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    <LockKeyhole size={18} />
                                    {passwordSaving ? 'Saving Password...' : requiresPasswordSetup ? 'Set Password' : 'Update Password'}
                                </button>
                                {!requiresPasswordSetup && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowPasswordPanel(false)
                                            setPassword('')
                                            setConfirmPassword('')
                                            setPasswordOtp('')
                                            setPasswordOtpSent(false)
                                            setPasswordError('')
                                            setPasswordMessage('')
                                            setShowNewPassword(false)
                                            setShowConfirmPassword(false)
                                        }}
                                        className="rs-button-secondary px-5 py-3"
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>
                            {!canSendPasswordOtp && (
                                <p className="text-xs text-[var(--rs-muted)]">
                                    Enter the new password and confirm password with at least 8 characters before sending OTP.
                                </p>
                            )}
                        </form>
                    </div>
                    )}
                </section>

                <aside className="space-y-6">
                    <div className="rs-panel p-6">
                        <h3 className="text-lg font-semibold text-[var(--rs-text)] mb-4">Account Details</h3>
                        <div className="space-y-4">
                            <InfoRow icon={<Mail size={16} />} label="Email" value={profile?.email ?? user?.email ?? '-'} />
                            <InfoRow icon={<Shield size={16} />} label="Role" value={profile?.role ?? 'driver'} />
                            <InfoRow label="Score" value={String(profile?.score ?? 0)} />
                            <InfoRow
                                label="Joined"
                                value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '-'}
                            />
                        </div>
                    </div>

                    <div className="rs-panel p-6">
                        <h3 className="text-lg font-semibold text-[var(--rs-text)] mb-2">Access Model</h3>
                        <p className="text-sm text-[var(--rs-muted)] leading-6">
                            Driver and owner accounts can use the main dashboard, map, and anomaly pages. Only admins can access user management and assign admin privileges.
                        </p>
                    </div>
                </aside>
            </div>
        </div>
    )
}

function InfoRow({
    label,
    value,
    icon,
}: {
    label: string
    value: string
    icon?: ReactNode
}) {
    return (
        <div className="rounded-xl border border-[var(--rs-border)] bg-[rgba(9,22,39,0.72)] px-4 py-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--rs-muted)]">
                {icon}
                <span>{label}</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-[var(--rs-text)] break-all">{value}</p>
        </div>
    )
}
