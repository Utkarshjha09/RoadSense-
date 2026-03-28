import { useEffect, useMemo, useState } from 'react'
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
} from 'react-native'
import * as Linking from 'expo-linking'
import { router } from 'expo-router'
import { isSupabaseConfigured, supabase } from '../src/services/supabase.service'
import { isOtpConfigured, sendOtp, verifyOtp } from '../src/services/otp.service'
import {
    clearLoginState,
    getCurrentSession,
    loadSessionFromDeepLink,
    markLoginOtpVerified,
    markPasswordLoginPending,
    requiresLoginOtpVerification,
    requiresPasswordSetup,
    sendPasswordResetEmail,
    signInWithGoogle,
} from '../src/services/mobile-auth.service'
import { theme } from '../src/theme'

type AuthMode = 'signIn' | 'signUp' | 'otp' | 'recovery'

export default function AuthScreen() {
    const [mode, setMode] = useState<AuthMode>('signIn')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [otp, setOtp] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [googleLoading, setGoogleLoading] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')

    useEffect(() => {
        void (async () => {
            try {
                const initialUrl = await Linking.getInitialURL()
                if (initialUrl) {
                    await handleDeepLink(initialUrl)
                    return
                }

                const session = await getCurrentSession()
                const otpPending = await requiresLoginOtpVerification()

                if (session?.user) {
                    setEmail(session.user.email || '')

                    if (otpPending && isOtpConfigured) {
                        setMode('otp')
                        setMessage('OTP sent to your email. Enter it to complete login.')
                        return
                    }

                    if (requiresPasswordSetup(session.user)) {
                        router.replace('/account')
                        return
                    }

                    router.replace('/home')
                }
            } catch (initError: any) {
                console.warn('Mobile auth init failed:', initError)
            }
        })()

        const subscription = Linking.addEventListener('url', ({ url }) => {
            void handleDeepLink(url)
        })

        return () => subscription.remove()
    }, [])

    const title = useMemo(() => {
        switch (mode) {
            case 'signUp':
                return 'Create Account'
            case 'otp':
                return 'Verify OTP'
            case 'recovery':
                return 'Reset Password'
            default:
                return 'Sign In'
        }
    }, [mode])

    async function handleDeepLink(url: string) {
        try {
            const { session, isRecovery } = await loadSessionFromDeepLink(url)

            if (!session?.user) {
                return
            }

            setEmail(session.user.email || '')

            if (isRecovery) {
                setMode('recovery')
                setMessage('Recovery session ready. Set your new password below.')
                return
            }

            if (requiresPasswordSetup(session.user)) {
                router.replace('/account')
                return
            }

            router.replace('/home')
        } catch (deepLinkError: any) {
            setError(deepLinkError.message || 'Failed to complete authentication.')
        }
    }

    async function handleEmailAuth() {
        if (!isSupabaseConfigured) {
            alert('Supabase is not configured in this build. Use Quick Login or rebuild with EXPO_PUBLIC_SUPABASE credentials.')
            return
        }

        setLoading(true)
        setError('')
        setMessage('')

        try {
            if (mode === 'signUp') {
                const { error: signUpError } = await supabase.auth.signUp({ email, password })
                if (signUpError) {
                    throw signUpError
                }

                setMessage('Account created. Check your email for verification if required, then sign in.')
                setMode('signIn')
                return
            }

            const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
            if (signInError) {
                throw signInError
            }

            if (isOtpConfigured) {
                await markPasswordLoginPending()
                await sendOtp(email.trim().toLowerCase(), 'login')
                setMode('otp')
                setOtp('')
                setMessage('OTP sent to your email. Enter it to complete login.')
                return
            }

            await clearLoginState()
            router.replace('/home')
        } catch (authError: any) {
            setError(authError.message || 'Authentication failed.')
        } finally {
            setLoading(false)
        }
    }

    async function handleVerifyOtp() {
        setLoading(true)
        setError('')

        try {
            await verifyOtp(email.trim().toLowerCase(), otp.trim(), 'login')
            await markLoginOtpVerified()
            setMessage('')
            router.replace('/home')
        } catch (otpError: any) {
            setError(otpError.message || 'OTP verification failed.')
        } finally {
            setLoading(false)
        }
    }

    async function handleSendReset() {
        if (!email.trim()) {
            setError('Enter your email first, then request a reset link.')
            return
        }

        setLoading(true)
        setError('')
        setMessage('')

        try {
            await sendPasswordResetEmail(email.trim().toLowerCase())
            setMessage('Password reset email sent. Open the link from your inbox to set a new password.')
        } catch (resetError: any) {
            setError(resetError.message || 'Failed to send reset email.')
        } finally {
            setLoading(false)
        }
    }

    async function handleRecoveryPasswordUpdate() {
        if (password.length < 8) {
            setError('Password must be at least 8 characters long.')
            return
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.')
            return
        }

        setLoading(true)
        setError('')

        try {
            const { error: updateError } = await supabase.auth.updateUser({ password })
            if (updateError) {
                throw updateError
            }

            setMessage('Password updated successfully. You can now sign in with email and password.')
            setMode('signIn')
            setPassword('')
            setConfirmPassword('')
        } catch (updatePasswordError: any) {
            setError(updatePasswordError.message || 'Failed to update password.')
        } finally {
            setLoading(false)
        }
    }

    async function handleGoogleAuth() {
        if (!isSupabaseConfigured) {
            setError('Supabase is not configured in this build.')
            return
        }

        setGoogleLoading(true)
        setError('')
        setMessage('')

        try {
            const session = await signInWithGoogle()
            setEmail(session?.user?.email || '')

            if (requiresPasswordSetup(session?.user || null)) {
                router.replace('/account')
                return
            }

            router.replace('/home')
        } catch (googleError: any) {
            if (googleError.message !== 'Google sign-in was cancelled.') {
                setError(googleError.message || 'Google sign-in failed.')
            }
        } finally {
            setGoogleLoading(false)
        }
    }

    function renderPrimaryForm() {
        if (mode === 'otp') {
            return (
                <View style={styles.form}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        style={[styles.input, styles.readOnlyInput]}
                        value={email}
                        editable={false}
                    />

                    <Text style={styles.label}>OTP</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter 6-digit OTP"
                        placeholderTextColor={theme.colors.muted}
                        value={otp}
                        onChangeText={setOtp}
                        keyboardType="number-pad"
                    />

                    <TouchableOpacity
                        style={[styles.buttonPrimary, loading && styles.buttonDisabled]}
                        onPress={() => void handleVerifyOtp()}
                        disabled={loading}
                    >
                        <Text style={styles.buttonPrimaryText}>{loading ? 'Verifying...' : 'Verify OTP'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.secondaryAction}
                        onPress={() => {
                            void sendOtp(email.trim().toLowerCase(), 'login')
                            setMessage('A fresh OTP has been sent to your email.')
                        }}
                    >
                        <Text style={styles.secondaryActionText}>Resend OTP</Text>
                    </TouchableOpacity>
                </View>
            )
        }

        if (mode === 'recovery') {
            return (
                <View style={styles.form}>
                    <Text style={styles.label}>New Password</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter a strong password"
                        placeholderTextColor={theme.colors.muted}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                    />

                    <TouchableOpacity style={styles.inlineAction} onPress={() => setShowPassword((value) => !value)}>
                        <Text style={styles.secondaryActionText}>{showPassword ? 'Hide Password' : 'Show Password'}</Text>
                    </TouchableOpacity>

                    <Text style={styles.label}>Confirm Password</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Re-enter your password"
                        placeholderTextColor={theme.colors.muted}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry={!showConfirmPassword}
                    />

                    <TouchableOpacity style={styles.inlineAction} onPress={() => setShowConfirmPassword((value) => !value)}>
                        <Text style={styles.secondaryActionText}>{showConfirmPassword ? 'Hide Password' : 'Show Password'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.buttonPrimary, loading && styles.buttonDisabled]}
                        onPress={() => void handleRecoveryPasswordUpdate()}
                        disabled={loading}
                    >
                        <Text style={styles.buttonPrimaryText}>{loading ? 'Updating...' : 'Set New Password'}</Text>
                    </TouchableOpacity>
                </View>
            )
        }

        return (
            <View style={styles.form}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                    style={styles.input}
                    placeholder="you@example.com"
                    placeholderTextColor={theme.colors.muted}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                />

                <Text style={styles.label}>Password</Text>
                <TextInput
                    style={styles.input}
                    placeholder="********"
                    placeholderTextColor={theme.colors.muted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                />

                <TouchableOpacity style={styles.inlineAction} onPress={() => setShowPassword((value) => !value)}>
                    <Text style={styles.secondaryActionText}>{showPassword ? 'Hide Password' : 'Show Password'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.buttonPrimary, loading && styles.buttonDisabled]}
                    onPress={() => void handleEmailAuth()}
                    disabled={loading}
                >
                    <Text style={styles.buttonPrimaryText}>
                        {loading ? 'Loading...' : mode === 'signUp' ? 'Create Account' : 'Sign In'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setMode(mode === 'signUp' ? 'signIn' : 'signUp')} style={styles.switchButton}>
                    <Text style={styles.switchText}>
                        {mode === 'signUp' ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => void handleSendReset()} style={styles.inlineAction}>
                    <Text style={styles.secondaryActionText}>Forgot Password?</Text>
                </TouchableOpacity>

                <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>Social</Text>
                    <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                    style={[styles.quickLoginButton, googleLoading && styles.buttonDisabled]}
                    onPress={() => void handleGoogleAuth()}
                    disabled={googleLoading}
                >
                    <Text style={styles.quickLoginText}>{googleLoading ? 'Opening Google...' : 'Continue with Google'}</Text>
                </TouchableOpacity>

                <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>Testing</Text>
                    <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity style={styles.quickLoginButton} onPress={() => router.replace('/home')}>
                    <Text style={styles.quickLoginText}>Quick Login (Bypass Auth)</Text>
                </TouchableOpacity>
                <Text style={styles.quickLoginNote}>Skip authentication for local testing</Text>
            </View>
        )
    }

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.glowOne} />
            <View style={styles.glowTwo} />

            <View style={styles.card}>
                <Text style={styles.kicker}>Road Intelligence</Text>
                <Text style={styles.title}>RoadSense</Text>
                <Text style={styles.subtitle}>
                    {mode === 'otp'
                        ? 'Email login requires OTP verification'
                        : mode === 'recovery'
                            ? 'Set a new password after opening the recovery link'
                            : 'Crowdsourced road quality monitoring'}
                </Text>

                <Text style={styles.sectionTitle}>{title}</Text>

                {message ? <Text style={styles.successText}>{message}</Text> : null}
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                {!isOtpConfigured && mode !== 'recovery' ? (
                    <Text style={styles.warningText}>OTP service is not configured in this build. Email/password login will continue without OTP.</Text>
                ) : null}

                {renderPrimaryForm()}
            </View>
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        backgroundColor: theme.colors.bg,
        justifyContent: 'center',
        padding: 20,
        position: 'relative',
    },
    glowOne: {
        position: 'absolute',
        width: 220,
        height: 220,
        borderRadius: 999,
        backgroundColor: '#49d3ff22',
        top: 60,
        left: -70,
    },
    glowTwo: {
        position: 'absolute',
        width: 210,
        height: 210,
        borderRadius: 999,
        backgroundColor: '#f5b23a1f',
        bottom: 40,
        right: -80,
    },
    card: {
        backgroundColor: theme.colors.panel,
        borderRadius: theme.radius.lg,
        padding: 24,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    kicker: {
        color: theme.colors.accent,
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: 2,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 6,
    },
    title: {
        fontSize: 34,
        fontWeight: '800',
        color: theme.colors.text,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: theme.colors.muted,
        textAlign: 'center',
        marginTop: 6,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: theme.colors.text,
        marginBottom: 14,
    },
    form: {
        gap: 14,
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
    buttonPrimary: {
        marginTop: 8,
        backgroundColor: theme.colors.accent,
        borderRadius: theme.radius.md,
        padding: 15,
        alignItems: 'center',
    },
    buttonPrimaryText: {
        color: '#032137',
        fontSize: 16,
        fontWeight: '800',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    switchButton: {
        marginTop: 8,
        alignItems: 'center',
    },
    switchText: {
        color: theme.colors.accent,
        fontSize: 14,
        fontWeight: '600',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: theme.colors.border,
    },
    dividerText: {
        color: theme.colors.muted,
        fontSize: 12,
        paddingHorizontal: 10,
        fontWeight: '600',
    },
    quickLoginButton: {
        backgroundColor: '#1f3c5b',
        borderRadius: theme.radius.md,
        padding: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    quickLoginText: {
        color: theme.colors.text,
        fontSize: 15,
        fontWeight: '700',
    },
    quickLoginNote: {
        color: theme.colors.muted,
        fontSize: 12,
        textAlign: 'center',
        marginTop: 8,
    },
    inlineAction: {
        alignItems: 'flex-end',
    },
    secondaryAction: {
        alignItems: 'center',
    },
    secondaryActionText: {
        color: theme.colors.accent,
        fontSize: 14,
        fontWeight: '700',
    },
    successText: {
        color: '#9ceccb',
        marginBottom: 12,
        fontWeight: '600',
    },
    errorText: {
        color: '#ff9f93',
        marginBottom: 12,
        fontWeight: '600',
    },
    warningText: {
        color: '#f5d88d',
        marginBottom: 12,
        fontWeight: '600',
    },
})
