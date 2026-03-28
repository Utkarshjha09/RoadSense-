import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../src/services/supabase.service'
import { sendOtp, verifyOtp } from '../src/services/otp.service'
import { getCurrentUser, requiresPasswordSetup, updatePassword } from '../src/services/mobile-auth.service'
import { theme } from '../src/theme'
import { BrandLoader } from '../components/brand-loader'

type EditableRole = 'driver' | 'owner'

export default function AccountScreen() {
    const [email, setEmail] = useState('')
    const [fullName, setFullName] = useState('')
    const [role, setRole] = useState<EditableRole>('driver')
    const [loading, setLoading] = useState(true)
    const [savingProfile, setSavingProfile] = useState(false)
    const [profileMessage, setProfileMessage] = useState('')
    const [profileError, setProfileError] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [otp, setOtp] = useState('')
    const [passwordMessage, setPasswordMessage] = useState('')
    const [passwordError, setPasswordError] = useState('')
    const [otpSent, setOtpSent] = useState(false)
    const [otpSending, setOtpSending] = useState(false)
    const [passwordSaving, setPasswordSaving] = useState(false)
    const [mustSetPassword, setMustSetPassword] = useState(false)
    const [showPasswordPanel, setShowPasswordPanel] = useState(false)
    const canSendOtp =
        password.trim().length >= 8 &&
        confirmPassword.trim().length >= 8 &&
        password === confirmPassword

    useEffect(() => {
        void loadAccount()
    }, [])

    async function loadAccount() {
        try {
            const user = await getCurrentUser()
            if (!user) {
                router.replace('/auth')
                return
            }

            setEmail(user.email || '')
            setMustSetPassword(requiresPasswordSetup(user))
            setShowPasswordPanel(requiresPasswordSetup(user))

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single()

            if (error) {
                throw error
            }

            setFullName(data?.full_name || '')
            setRole(data?.role === 'owner' ? 'owner' : 'driver')
        } catch (error: any) {
            setProfileError(error.message || 'Failed to load account.')
        } finally {
            setLoading(false)
        }
    }

    async function handleSaveProfile() {
        const user = await getCurrentUser()
        if (!user) {
            router.replace('/auth')
            return
        }

        setSavingProfile(true)
        setProfileMessage('')
        setProfileError('')

        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: fullName.trim() || null,
                    role,
                })
                .eq('id', user.id)

            if (error) {
                throw error
            }

            setProfileMessage('Account details updated.')
        } catch (error: any) {
            setProfileError(error.message || 'Failed to save account details.')
        } finally {
            setSavingProfile(false)
        }
    }

    async function handleSendOtp() {
        if (!canSendOtp) {
            setPasswordError('Enter matching passwords with at least 8 characters before sending OTP.')
            return
        }

        setOtpSending(true)
        setPasswordError('')
        setPasswordMessage('')

        try {
            await sendOtp(email.trim().toLowerCase(), 'password_change')
            setOtpSent(true)
            setPasswordMessage('OTP sent to your email.')
        } catch (error: any) {
            setPasswordError(error.message || 'Failed to send OTP.')
        } finally {
            setOtpSending(false)
        }
    }

    async function handleSetPassword() {
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
            if (!otpSent) {
                throw new Error('Send OTP before updating the password.')
            }

            await verifyOtp(email.trim().toLowerCase(), otp.trim(), 'password_change')
            await updatePassword(password)
            setPassword('')
            setConfirmPassword('')
            setOtp('')
            setOtpSent(false)
            setMustSetPassword(false)
            setPasswordMessage('Password updated successfully.')
            setShowPasswordPanel(false)
        } catch (error: any) {
            setPasswordError(error.message || 'Failed to update password.')
        } finally {
            setPasswordSaving(false)
        }
    }

    if (loading) {
        return (
            <View style={styles.center}>
                <BrandLoader label="Loading account..." />
            </View>
        )
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.panel}>
                <Text style={styles.sectionTitle}>Account</Text>
                {profileMessage ? <Text style={styles.successText}>{profileMessage}</Text> : null}
                {profileError ? <Text style={styles.errorText}>{profileError}</Text> : null}

                <Text style={styles.label}>Email</Text>
                <TextInput style={[styles.input, styles.readOnlyInput]} value={email} editable={false} />

                <Text style={styles.label}>Full Name</Text>
                <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Your full name" placeholderTextColor={theme.colors.muted} />

                <Text style={styles.label}>Role</Text>
                <View style={styles.roleRow}>
                    <TouchableOpacity
                        style={[styles.roleChip, role === 'driver' && styles.roleChipActive]}
                        onPress={() => setRole('driver')}
                    >
                        <Text style={[styles.roleChipText, role === 'driver' && styles.roleChipTextActive]}>Driver</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.roleChip, role === 'owner' && styles.roleChipActive]}
                        onPress={() => setRole('owner')}
                    >
                        <Text style={[styles.roleChipText, role === 'owner' && styles.roleChipTextActive]}>Owner</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={[styles.buttonPrimary, savingProfile && styles.buttonDisabled]}
                    onPress={() => void handleSaveProfile()}
                    disabled={savingProfile}
                >
                    <Text style={styles.buttonPrimaryText}>{savingProfile ? 'Saving...' : 'Save Account'}</Text>
                </TouchableOpacity>
            </View>

            {!showPasswordPanel ? (
                <View style={styles.panel}>
                    <Text style={styles.sectionTitle}>Password</Text>
                    <Text style={styles.panelText}>
                        {mustSetPassword
                            ? 'Set a password so this account can use both Google and email/password login.'
                            : 'Change your password whenever you need to.'}
                    </Text>
                    <TouchableOpacity style={styles.buttonSecondary} onPress={() => setShowPasswordPanel(true)}>
                        <Text style={styles.buttonSecondaryText}>{mustSetPassword ? 'Set Password' : 'Change Password'}</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.panel}>
                    <Text style={styles.sectionTitle}>{mustSetPassword ? 'Set Password' : 'Change Password'}</Text>
                    {passwordMessage ? <Text style={styles.successText}>{passwordMessage}</Text> : null}
                    {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

                    <Text style={styles.label}>New Password</Text>
                    <TextInput
                        style={styles.input}
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Enter a strong password"
                        placeholderTextColor={theme.colors.muted}
                        secureTextEntry
                    />

                    <Text style={styles.label}>Confirm Password</Text>
                    <TextInput
                        style={styles.input}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder="Re-enter your password"
                        placeholderTextColor={theme.colors.muted}
                        secureTextEntry
                    />

                    <Text style={styles.label}>OTP</Text>
                    <TextInput
                        style={styles.input}
                        value={otp}
                        onChangeText={setOtp}
                        placeholder="Enter OTP sent to your email"
                        placeholderTextColor={theme.colors.muted}
                        keyboardType="number-pad"
                    />

                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            style={[styles.buttonSecondary, (otpSending || !canSendOtp) && styles.buttonDisabled]}
                            onPress={() => void handleSendOtp()}
                            disabled={otpSending || !canSendOtp}
                        >
                            <Text style={styles.buttonSecondaryText}>{otpSending ? 'Sending...' : otpSent ? 'Resend OTP' : 'Send OTP'}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.buttonPrimary, passwordSaving && styles.buttonDisabled]}
                            onPress={() => void handleSetPassword()}
                            disabled={passwordSaving}
                        >
                            <Text style={styles.buttonPrimaryText}>{passwordSaving ? 'Updating...' : mustSetPassword ? 'Set Password' : 'Update Password'}</Text>
                        </TouchableOpacity>
                    </View>

                    {!canSendOtp ? (
                        <Text style={styles.helperText}>
                            Enter the new password and confirm password with at least 8 characters before sending OTP.
                        </Text>
                    ) : null}

                    {!mustSetPassword ? (
                        <TouchableOpacity style={styles.inlineButton} onPress={() => setShowPasswordPanel(false)}>
                            <Text style={styles.inlineButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            )}
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.bg,
    },
    content: {
        padding: 20,
        paddingTop: 48,
        gap: 16,
        paddingBottom: 30,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.bg,
    },
    panel: {
        backgroundColor: theme.colors.panel,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: 20,
        gap: 12,
    },
    sectionTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: theme.colors.text,
    },
    panelText: {
        color: theme.colors.muted,
        fontSize: 14,
        lineHeight: 20,
    },
    label: {
        fontSize: 13,
        fontWeight: '700',
        color: theme.colors.muted,
    },
    input: {
        backgroundColor: theme.colors.panelSoft,
        borderRadius: theme.radius.md,
        padding: 13,
        fontSize: 16,
        color: theme.colors.text,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    readOnlyInput: {
        opacity: 0.8,
    },
    roleRow: {
        flexDirection: 'row',
        gap: 10,
    },
    roleChip: {
        flex: 1,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.md,
        paddingVertical: 12,
        alignItems: 'center',
        backgroundColor: theme.colors.panelSoft,
    },
    roleChipActive: {
        backgroundColor: theme.colors.accent,
        borderColor: theme.colors.accent,
    },
    roleChipText: {
        color: theme.colors.text,
        fontWeight: '700',
    },
    roleChipTextActive: {
        color: '#032137',
    },
    buttonPrimary: {
        backgroundColor: theme.colors.accent,
        borderRadius: theme.radius.md,
        paddingVertical: 14,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    buttonPrimaryText: {
        color: '#032137',
        fontSize: 15,
        fontWeight: '800',
    },
    buttonSecondary: {
        backgroundColor: '#1f3c5b',
        borderRadius: theme.radius.md,
        paddingVertical: 14,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: theme.colors.border,
        flex: 1,
    },
    buttonSecondaryText: {
        color: theme.colors.text,
        fontSize: 15,
        fontWeight: '700',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    actionRow: {
        flexDirection: 'row',
        gap: 10,
    },
    inlineButton: {
        alignSelf: 'flex-end',
        paddingVertical: 8,
    },
    inlineButtonText: {
        color: theme.colors.accent,
        fontWeight: '700',
    },
    successText: {
        color: '#9ceccb',
        fontWeight: '600',
    },
    errorText: {
        color: '#ff9f93',
        fontWeight: '600',
    },
    helperText: {
        color: theme.colors.muted,
        fontSize: 12,
        lineHeight: 18,
    },
})
