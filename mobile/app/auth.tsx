import { useEffect, useMemo, useRef, useState } from 'react'
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
} from 'react-native'
import * as Linking from 'expo-linking'
import { router } from 'expo-router'
import { Eye, EyeOff, Navigation, Shield, Lock, ChevronLeft } from 'lucide-react-native'
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

type AuthMode = 'signIn' | 'signUp' | 'otp' | 'recovery' | 'forgot'
type SignUpRole = 'Driver' | 'Fleet Operator' | 'Researcher' | 'Municipality'

const SIGNUP_ROLES: { label: SignUpRole; desc: string }[] = [
    { label: 'Driver', desc: 'Personal use' },
    { label: 'Fleet Operator', desc: 'Manage vehicles' },
    { label: 'Researcher', desc: 'Academic / study' },
    { label: 'Municipality', desc: 'Public infrastructure' },
]

export default function AuthScreen() {
    const [mode, setMode] = useState<AuthMode>('signIn')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [fullName, setFullName] = useState('')
    const [signUpRole, setSignUpRole] = useState<SignUpRole>('Driver')
    const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', ''])
    const otpRefs = useRef<(TextInput | null)[]>([])
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [googleLoading, setGoogleLoading] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')

    const otp = otpDigits.join('')

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
            case 'forgot':
                return 'Reset password'
            default:
                return 'Sign In'
        }
    }, [mode])

    const subtitle = useMemo(() => {
        switch (mode) {
            case 'signUp':
                return 'Tell us about yourself'
            case 'otp':
                return 'We sent a 6-digit code to your address. It expires in 10 minutes.'
            case 'recovery':
                return 'Set a new password after opening the recovery link'
            case 'forgot':
                return 'Enter your email and we will send you a verification code.'
            default:
                return 'Welcome back. Your roads are waiting.'
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
                const { error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName.trim(),
                            role: signUpRole,
                        },
                    },
                })
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
                setOtpDigits(['', '', '', '', '', ''])
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

    function handleOtpDigitChange(index: number, value: string) {
        const digit = value.replace(/[^0-9]/g, '').slice(-1)
        setOtpDigits((prev) => {
            const next = [...prev]
            next[index] = digit
            return next
        })

        if (digit && index < 5) {
            otpRefs.current[index + 1]?.focus()
        }
    }

    function handleOtpKeyPress(index: number, key: string) {
        if (key === 'Backspace' && !otpDigits[index] && index > 0) {
            otpRefs.current[index - 1]?.focus()
        }
    }

    function renderPrimaryForm() {
        if (mode === 'otp') {
            return (
                <View style={styles.form}>
                    <View style={styles.iconBadge}>
                        <Shield size={26} color={theme.colors.accent} strokeWidth={1.5} />
                    </View>

                    <View style={styles.otpRow}>
                        {otpDigits.map((digit, index) => (
                            <TextInput
                                key={index}
                                ref={(node) => {
                                    otpRefs.current[index] = node
                                }}
                                style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                                value={digit}
                                onChangeText={(value) => handleOtpDigitChange(index, value)}
                                onKeyPress={({ nativeEvent }) => handleOtpKeyPress(index, nativeEvent.key)}
                                keyboardType="number-pad"
                                maxLength={1}
                                textAlign="center"
                            />
                        ))}
                    </View>

                    <TouchableOpacity
                        style={[styles.buttonPrimary, loading && styles.buttonDisabled]}
                        onPress={() => void handleVerifyOtp()}
                        disabled={loading}
                    >
                        <Text style={styles.buttonPrimaryText}>{loading ? 'Verifying...' : 'Verify'}</Text>
                    </TouchableOpacity>

                    <Text style={styles.switchText}>
                        {"Didn't get it? "}
                        <Text
                            style={styles.switchTextAccent}
                            onPress={() => {
                                void sendOtp(email.trim().toLowerCase(), 'login')
                                setMessage('A fresh OTP has been sent to your email.')
                            }}
                        >
                            Resend code
                        </Text>
                    </Text>
                </View>
            )
        }

        if (mode === 'forgot') {
            return (
                <View style={styles.form}>
                    <View style={[styles.iconBadge, styles.iconBadgeIndigo]}>
                        <Lock size={26} color={theme.colors.accentIndigo} strokeWidth={1.5} />
                    </View>

                    <Text style={styles.label}>Email address</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="you@example.com"
                        placeholderTextColor={theme.colors.muted}
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />

                    <TouchableOpacity
                        style={[styles.buttonPrimary, styles.buttonIndigo, loading && styles.buttonDisabled]}
                        onPress={() => void handleSendReset()}
                        disabled={loading}
                    >
                        <Text style={styles.buttonPrimaryText}>{loading ? 'Sending...' : 'Send Reset Code'}</Text>
                    </TouchableOpacity>
                </View>
            )
        }

        if (mode === 'signUp') {
            return (
                <View style={styles.form}>
                    <Text style={styles.label}>Full name</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Alex Kumar"
                        placeholderTextColor={theme.colors.muted}
                        value={fullName}
                        onChangeText={setFullName}
                    />

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
                    <View style={styles.inputRow}>
                        <TextInput
                            style={[styles.input, styles.inputFlex]}
                            placeholder="Min. 8 characters"
                            placeholderTextColor={theme.colors.muted}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                        />
                        <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword((value) => !value)}>
                            {showPassword ? <EyeOff size={17} color={theme.colors.muted} /> : <Eye size={17} color={theme.colors.muted} />}
                        </TouchableOpacity>
                    </View>

                    <Text style={[styles.label, styles.roleLabel]}>I am a</Text>
                    <View style={styles.roleGrid}>
                        {SIGNUP_ROLES.map((r) => {
                            const active = r.label === signUpRole
                            return (
                                <TouchableOpacity
                                    key={r.label}
                                    style={[styles.roleCard, active && styles.roleCardActive]}
                                    onPress={() => setSignUpRole(r.label)}
                                >
                                    <Text style={[styles.roleCardTitle, active && styles.roleCardTitleActive]}>{r.label}</Text>
                                    <Text style={styles.roleCardDesc}>{r.desc}</Text>
                                </TouchableOpacity>
                            )
                        })}
                    </View>

                    <TouchableOpacity
                        style={[styles.buttonPrimary, loading && styles.buttonDisabled]}
                        onPress={() => void handleEmailAuth()}
                        disabled={loading}
                    >
                        <Text style={styles.buttonPrimaryText}>{loading ? 'Creating...' : 'Continue'}</Text>
                    </TouchableOpacity>

                    <Text style={styles.switchText}>
                        Already have an account?{' '}
                        <Text style={styles.switchTextAccent} onPress={() => setMode('signIn')}>
                            Sign in
                        </Text>
                    </Text>
                </View>
            )
        }

        if (mode === 'recovery') {
            return (
                <View style={styles.form}>
                    <Text style={styles.label}>New Password</Text>
                    <View style={styles.inputRow}>
                        <TextInput
                            style={[styles.input, styles.inputFlex]}
                            placeholder="Enter a strong password"
                            placeholderTextColor={theme.colors.muted}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                        />
                        <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword((value) => !value)}>
                            {showPassword ? <EyeOff size={17} color={theme.colors.muted} /> : <Eye size={17} color={theme.colors.muted} />}
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.label}>Confirm Password</Text>
                    <View style={styles.inputRow}>
                        <TextInput
                            style={[styles.input, styles.inputFlex]}
                            placeholder="Re-enter your password"
                            placeholderTextColor={theme.colors.muted}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry={!showConfirmPassword}
                        />
                        <TouchableOpacity style={styles.eyeButton} onPress={() => setShowConfirmPassword((value) => !value)}>
                            {showConfirmPassword ? <EyeOff size={17} color={theme.colors.muted} /> : <Eye size={17} color={theme.colors.muted} />}
                        </TouchableOpacity>
                    </View>

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
                <View style={styles.inputRow}>
                    <TextInput
                        style={[styles.input, styles.inputFlex]}
                        placeholder="********"
                        placeholderTextColor={theme.colors.muted}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword((value) => !value)}>
                        {showPassword ? <EyeOff size={17} color={theme.colors.muted} /> : <Eye size={17} color={theme.colors.muted} />}
                    </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={() => setMode('forgot')} style={styles.forgotLink}>
                    <Text style={styles.secondaryActionText}>Forgot password?</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.buttonPrimary, loading && styles.buttonDisabled]}
                    onPress={() => void handleEmailAuth()}
                    disabled={loading}
                >
                    <Text style={styles.buttonPrimaryText}>{loading ? 'Loading...' : 'Sign In'}</Text>
                </TouchableOpacity>

                <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>or</Text>
                    <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                    style={[styles.socialButton, googleLoading && styles.buttonDisabled]}
                    onPress={() => void handleGoogleAuth()}
                    disabled={googleLoading}
                >
                    <Text style={styles.socialButtonText}>{googleLoading ? 'Opening Google...' : 'Continue with Google'}</Text>
                </TouchableOpacity>

                <Text style={styles.switchText}>
                    {"Don't have an account? "}
                    <Text style={styles.switchTextAccent} onPress={() => setMode('signUp')}>
                        Create one
                    </Text>
                </Text>
            </View>
        )
    }

    return (
        <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                <View style={styles.glowOne} />
                <View style={styles.glowTwo} />

                {mode === 'signIn' ? (
                    <View style={styles.brandRow}>
                        <View style={styles.brandIcon}>
                            <Navigation size={15} color={theme.colors.accent} strokeWidth={1.6} />
                        </View>
                        <Text style={styles.brandText}>
                            Road<Text style={styles.brandTextAccent}>Sense</Text>
                        </Text>
                    </View>
                ) : mode !== 'recovery' ? (
                    <TouchableOpacity style={styles.backRow} onPress={() => setMode('signIn')}>
                        <ChevronLeft size={20} color={theme.colors.muted} />
                        <Text style={styles.backText}>Back</Text>
                    </TouchableOpacity>
                ) : null}

                <Text style={styles.title}>{title === 'Sign In' ? 'Sign in' : title}</Text>
                <Text style={styles.subtitle}>{subtitle}</Text>

                {message ? <Text style={styles.successText}>{message}</Text> : null}
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                {!isOtpConfigured && mode !== 'recovery' ? (
                    <Text style={styles.warningText}>OTP service is not configured in this build. Email/password login will continue without OTP.</Text>
                ) : null}

                {renderPrimaryForm()}
            </ScrollView>
        </KeyboardAvoidingView>
    )
}

const styles = StyleSheet.create({
    flex: {
        flex: 1,
        backgroundColor: theme.colors.bg,
    },
    container: {
        flexGrow: 1,
        backgroundColor: theme.colors.bg,
        justifyContent: 'center',
        padding: 24,
        position: 'relative',
    },
    glowOne: {
        position: 'absolute',
        width: 240,
        height: 240,
        borderRadius: 999,
        backgroundColor: 'rgba(34,211,238,0.09)',
        top: 40,
        left: -80,
    },
    glowTwo: {
        position: 'absolute',
        width: 220,
        height: 220,
        borderRadius: 999,
        backgroundColor: 'rgba(251,191,36,0.07)',
        bottom: 60,
        right: -90,
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 28,
    },
    backRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 20,
        alignSelf: 'flex-start',
    },
    backText: {
        color: theme.colors.muted,
        fontFamily: theme.fonts.body,
        fontSize: 13,
    },
    iconBadge: {
        width: 56,
        height: 56,
        borderRadius: 18,
        backgroundColor: 'rgba(34,211,238,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(34,211,238,0.18)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    iconBadgeIndigo: {
        backgroundColor: 'rgba(129,140,248,0.08)',
        borderColor: 'rgba(129,140,248,0.18)',
    },
    otpRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 4,
    },
    otpBox: {
        flex: 1,
        height: 56,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.panel,
        color: theme.colors.text,
        fontFamily: theme.fonts.display,
        fontSize: 22,
    },
    otpBoxFilled: {
        backgroundColor: 'rgba(34,211,238,0.07)',
        borderColor: 'rgba(34,211,238,0.32)',
    },
    buttonIndigo: {
        backgroundColor: theme.colors.accentIndigo,
    },
    roleLabel: {
        marginTop: 2,
        marginBottom: 2,
    },
    roleGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    roleCard: {
        width: '47%',
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.panel,
        padding: 14,
    },
    roleCardActive: {
        backgroundColor: 'rgba(34,211,238,0.08)',
        borderColor: 'rgba(34,211,238,0.35)',
    },
    roleCardTitle: {
        color: theme.colors.text,
        fontFamily: theme.fonts.bodySemiBold,
        fontSize: 13,
        marginBottom: 2,
    },
    roleCardTitleActive: {
        color: theme.colors.accent,
    },
    roleCardDesc: {
        color: theme.colors.muted2,
        fontFamily: theme.fonts.body,
        fontSize: 10,
    },
    brandIcon: {
        width: 30,
        height: 30,
        borderRadius: 10,
        backgroundColor: 'rgba(34,211,238,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(34,211,238,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    brandText: {
        fontFamily: theme.fonts.display,
        fontSize: 17,
        color: theme.colors.text,
    },
    brandTextAccent: {
        color: theme.colors.accent,
    },
    title: {
        fontFamily: theme.fonts.display,
        fontSize: 32,
        color: theme.colors.text,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontFamily: theme.fonts.body,
        fontSize: 14,
        color: theme.colors.muted,
        marginTop: 6,
        marginBottom: 28,
    },
    form: {
        gap: 14,
    },
    label: {
        fontFamily: theme.fonts.bodySemiBold,
        fontSize: 11,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        color: theme.colors.muted2,
        marginBottom: -6,
    },
    input: {
        backgroundColor: theme.colors.panel,
        borderRadius: theme.radius.md,
        padding: 14,
        fontSize: 15,
        fontFamily: theme.fonts.body,
        color: theme.colors.text,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    inputFlex: {
        flex: 1,
        paddingRight: 44,
    },
    eyeButton: {
        position: 'absolute',
        right: 14,
        padding: 4,
    },
    readOnlyInput: {
        opacity: 0.7,
    },
    forgotLink: {
        alignItems: 'flex-end',
        marginTop: -4,
    },
    buttonPrimary: {
        marginTop: 4,
        backgroundColor: theme.colors.accent,
        borderRadius: theme.radius.md,
        padding: 15,
        alignItems: 'center',
    },
    buttonPrimaryText: {
        color: theme.colors.bg,
        fontSize: 15,
        fontFamily: theme.fonts.bodyBold,
        letterSpacing: 0.2,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    switchText: {
        textAlign: 'center',
        fontFamily: theme.fonts.body,
        fontSize: 13,
        color: theme.colors.muted,
    },
    switchTextAccent: {
        color: theme.colors.accent,
        fontFamily: theme.fonts.bodySemiBold,
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: theme.colors.border,
    },
    dividerText: {
        color: theme.colors.muted2,
        fontFamily: theme.fonts.body,
        fontSize: 11,
        paddingHorizontal: 10,
    },
    socialButton: {
        backgroundColor: theme.colors.panel,
        borderRadius: theme.radius.md,
        padding: 13,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    socialButtonText: {
        color: theme.colors.text,
        fontSize: 14,
        fontFamily: theme.fonts.bodySemiBold,
    },
    secondaryAction: {
        alignItems: 'center',
    },
    secondaryActionText: {
        color: theme.colors.accent,
        fontSize: 13,
        fontFamily: theme.fonts.bodySemiBold,
    },
    successText: {
        color: theme.colors.success,
        fontFamily: theme.fonts.body,
        fontSize: 13,
        marginBottom: 12,
    },
    errorText: {
        color: theme.colors.danger,
        fontFamily: theme.fonts.body,
        fontSize: 13,
        marginBottom: 12,
    },
    warningText: {
        color: theme.colors.accentWarm,
        fontFamily: theme.fonts.body,
        fontSize: 12,
        marginBottom: 12,
    },
})
