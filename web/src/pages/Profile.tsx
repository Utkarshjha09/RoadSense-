import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Mail, Shield, Save, LockKeyhole, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../components/AuthProvider'
import { supabase } from '../lib/supabase'
import { sendOtp, verifyOtp } from '../lib/otp'
import { Card, Button } from '../components/ui'

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
                <div className="rs-banner rs-banner-warn">
                    <LockKeyhole size={16} className="mt-0.5 shrink-0" />
                    <div>
                        <p className="font-semibold">Set a password to complete your first Google sign-in.</p>
                        <p className="rs-muted mt-1">
                            Once set, you can use either `Continue with Google` or your email and password on future logins.
                        </p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.7fr] gap-6">
                <section className="space-y-6">
                    <Card className="p-5 sm:p-6">
                        <div className="mb-5">
                            <h2 className="rs-heading">Edit Profile</h2>
                            <p className="text-[13px] rs-muted mt-1">
                                Update your name, email, and account role.
                            </p>
                        </div>

                        {message && (
                            <div className="rs-banner rs-banner-success mb-4">
                                {message}
                            </div>
                        )}

                        {error && (
                            <div className="rs-banner rs-banner-danger mb-4">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="rs-label">
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
                                <label className="rs-label">
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
                                <p className="text-[11px] rs-faint mt-2">
                                    If you change your email, Supabase may send a confirmation message to the new address.
                                </p>
                            </div>

                            <div>
                                <label className="rs-label">
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
                                <p className="text-[11px] rs-faint mt-2">
                                    `Owner` is for your own vehicle account. `Admin` remains restricted and cannot be self-assigned here.
                                </p>
                            </div>

                            <Button type="submit" icon={Save} disabled={saving}>
                                {saving ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </form>
                    </Card>

                    {!showPasswordPanel ? (
                        <Card className="p-5 sm:p-6">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div>
                                    <h2 className="rs-heading">Password</h2>
                                    <p className="text-[13px] rs-muted mt-1">Change your password when needed.</p>
                                </div>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    icon={LockKeyhole}
                                    onClick={() => setShowPasswordPanel(true)}
                                >
                                    Change Password
                                </Button>
                            </div>
                        </Card>
                    ) : (
                    <Card className="p-5 sm:p-6">
                        <div className="mb-5">
                            <h2 className="rs-heading">
                                {requiresPasswordSetup ? 'Set Password' : 'Change Password'}
                            </h2>
                            <p className="text-[13px] rs-muted mt-1">
                                {isGoogleUser
                                    ? 'Use this to enable email/password login in addition to Google.'
                                    : 'Update the password used for email/password sign-in.'}
                            </p>
                        </div>

                        {passwordMessage && (
                            <div className="rs-banner rs-banner-success mb-4">
                                {passwordMessage}
                            </div>
                        )}

                        {passwordError && (
                            <div className="rs-banner rs-banner-danger mb-4">
                                {passwordError}
                            </div>
                        )}

                        <form onSubmit={handlePasswordSubmit} className="space-y-5">
                            <div>
                                <label className="rs-label">
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
                                <label className="rs-label">
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
                                <label className="rs-label">
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
                                <Button
                                    type="button"
                                    variant="secondary"
                                    icon={Mail}
                                    onClick={() => void handleSendPasswordOtp()}
                                    disabled={otpSending || !canSendPasswordOtp}
                                >
                                    {otpSending ? 'Sending OTP...' : passwordOtpSent ? 'Resend OTP' : 'Send OTP'}
                                </Button>
                                <Button type="submit" icon={LockKeyhole} disabled={passwordSaving}>
                                    {passwordSaving ? 'Saving Password...' : requiresPasswordSetup ? 'Set Password' : 'Update Password'}
                                </Button>
                                {!requiresPasswordSetup && (
                                    <Button
                                        type="button"
                                        variant="ghost"
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
                                    >
                                        Cancel
                                    </Button>
                                )}
                            </div>
                            {!canSendPasswordOtp && (
                                <p className="text-[11px] rs-faint">
                                    Enter the new password and confirm password with at least 8 characters before sending OTP.
                                </p>
                            )}
                        </form>
                    </Card>
                    )}
                </section>

                <aside className="space-y-6">
                    <Card className="p-5">
                        <h2 className="rs-heading mb-4">Account Details</h2>
                        <div className="space-y-4">
                            <InfoRow icon={<Mail size={13} />} label="Email" value={profile?.email ?? user?.email ?? '-'} />
                            <InfoRow icon={<Shield size={13} />} label="Role" value={profile?.role ?? 'driver'} />
                            <InfoRow label="Score" value={String(profile?.score ?? 0)} />
                            <InfoRow
                                label="Joined"
                                value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '-'}
                            />
                        </div>
                    </Card>

                    <Card className="p-5">
                        <h2 className="rs-heading mb-2">Access Level</h2>
                        <p className="text-[14px] rs-muted leading-relaxed">
                            Driver and owner accounts can access the dashboard, map, and anomaly pages. Only admins can
                            manage users or assign admin privileges.
                        </p>
                    </Card>
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
        <div>
            <div className="flex items-center gap-1.5 text-[var(--rs-text-faint)]">
                {icon}
                <span className="rs-kicker">{label}</span>
            </div>
            <p className="mt-1 text-[15px] text-[var(--rs-text)] break-all">{value}</p>
        </div>
    )
}
