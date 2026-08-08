import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { supabase } from '../src/services/supabase.service'
import { sendOtp, verifyOtp } from '../src/services/otp.service'
import { getCurrentUser, requiresPasswordSetup, updatePassword } from '../src/services/mobile-auth.service'
import { theme } from '../src/theme'
import { BrandLoader } from '../components/brand-loader'
import { BottomNavBar } from '../components/bottom-nav-bar'
import { Pill } from '../components/ui-kit'

type EditableRole = 'driver' | 'owner'

export default function AccountScreen() {
    const insets = useSafeAreaInsets()
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
    const passwordPanelTitle = mustSetPassword ? 'Set Password' : 'Change Password'
    const passwordSubmitLabel = mustSetPassword ? 'Set Password' : 'Change Password'
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
            setPasswordMessage(mustSetPassword ? 'Password set successfully.' : 'Password updated successfully.')
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

    const initials = (fullName.trim() || email.trim() || '?')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || '?'

    return (
        <View style={styles.screen}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: 128 }]}
            >
                <View style={styles.profileHeader}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                    <View style={styles.profileHeaderCopy}>
                        <Text style={styles.profileName}>{fullName.trim() || 'RoadSense User'}</Text>
                        <Text style={styles.profileEmail}>{email}</Text>
                        <Pill tone="cyan" size="xs">{role === 'owner' ? 'Owner' : 'Driver'}</Pill>
                    </View>
                </View>

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

                <View style={styles.panel}>
                    <Text style={styles.sectionTitle}>{passwordPanelTitle}</Text>
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
                            style={[styles.buttonSecondary, otpSending && styles.buttonDisabled]}
                            onPress={() => void handleSendOtp()}
                            disabled={otpSending}
                        >
                            <Text style={styles.buttonSecondaryText}>{otpSending ? 'Sending...' : otpSent ? 'Resend OTP' : 'Send OTP'}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.buttonPrimary, passwordSaving && styles.buttonDisabled]}
                            onPress={() => void handleSetPassword()}
                            disabled={passwordSaving}
                        >
                            <Text style={styles.buttonPrimaryText}>{passwordSaving ? 'Updating...' : passwordSubmitLabel}</Text>
                        </TouchableOpacity>
                    </View>

                    {!canSendOtp ? (
                        <Text style={styles.helperText}>
                            Enter the new password and confirm password with at least 8 characters before sending OTP.
                        </Text>
                    ) : null}
                </View>
            </ScrollView>
            <BottomNavBar active="account" />
        </View>
    )
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: theme.colors.bg,
    },
    container: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 20,
        gap: 14,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.bg,
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginBottom: 4,
    },
    avatar: {
        width: 64,
        height: 64,
        borderRadius: 20,
        backgroundColor: 'rgba(34,211,238,0.1)',
        borderWidth: 1.5,
        borderColor: 'rgba(34,211,238,0.28)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontFamily: theme.fonts.display,
        fontSize: 22,
        color: theme.colors.accent,
    },
    profileHeaderCopy: {
        flex: 1,
        gap: 6,
    },
    profileName: {
        fontFamily: theme.fonts.display,
        fontSize: 19,
        color: theme.colors.text,
        letterSpacing: -0.3,
    },
    profileEmail: {
        fontFamily: theme.fonts.body,
        fontSize: 12,
        color: theme.colors.muted,
    },
    panel: {
        backgroundColor: theme.colors.panel,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: theme.colors.border,
        paddingVertical: 20,
        paddingHorizontal: 16,
        gap: 10,
    },
    sectionTitle: {
        fontSize: 18,
        fontFamily: theme.fonts.display,
        color: theme.colors.text,
    },
    label: {
        fontSize: 11,
        fontFamily: theme.fonts.bodySemiBold,
        color: theme.colors.muted2,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    input: {
        backgroundColor: theme.colors.panelSoft,
        borderRadius: theme.radius.md,
        paddingVertical: 14,
        paddingHorizontal: 14,
        fontSize: 14,
        fontFamily: theme.fonts.body,
        color: theme.colors.text,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    readOnlyInput: {
        opacity: 0.7,
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
        paddingVertical: 14,
        alignItems: 'center',
        backgroundColor: theme.colors.panelSoft,
    },
    roleChipActive: {
        backgroundColor: 'rgba(34,211,238,0.1)',
        borderColor: 'rgba(34,211,238,0.4)',
    },
    roleChipText: {
        color: theme.colors.muted,
        fontFamily: theme.fonts.bodySemiBold,
        fontSize: 14,
    },
    roleChipTextActive: {
        color: theme.colors.accent,
    },
    buttonPrimary: {
        backgroundColor: theme.colors.accent,
        borderRadius: theme.radius.md,
        paddingVertical: 15,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    buttonPrimaryText: {
        color: theme.colors.bg,
        fontSize: 14,
        fontFamily: theme.fonts.bodyBold,
    },
    buttonSecondary: {
        backgroundColor: theme.colors.panelSoft,
        borderRadius: theme.radius.md,
        paddingVertical: 15,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: theme.colors.border,
        flex: 1,
    },
    buttonSecondaryText: {
        color: theme.colors.text,
        fontSize: 14,
        fontFamily: theme.fonts.bodyBold,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    actionRow: {
        flexDirection: 'row',
        gap: 10,
    },
    successText: {
        color: theme.colors.success,
        fontFamily: theme.fonts.body,
        fontSize: 13,
    },
    errorText: {
        color: theme.colors.danger,
        fontFamily: theme.fonts.body,
        fontSize: 13,
    },
    helperText: {
        color: theme.colors.muted,
        fontFamily: theme.fonts.body,
        fontSize: 11,
        lineHeight: 17,
    },
})
