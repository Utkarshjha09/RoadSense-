import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, type Profile } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

interface AuthContextType {
    user: User | null
    profile: Profile | null
    isAdmin: boolean
    loading: boolean
    isGoogleUser: boolean
    requiresPasswordSetup: boolean
    requiresLoginOtpVerification: boolean
    signIn: (email: string, password: string) => Promise<void>
    signInWithGoogle: () => Promise<void>
    sendPasswordResetEmail: (email: string) => Promise<void>
    updatePassword: (password: string) => Promise<void>
    markLoginOtpVerified: () => void
    signOut: () => Promise<void>
    refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)
const LOGIN_METHOD_KEY = 'roadsense_login_method'
const LOGIN_OTP_VERIFIED_KEY = 'roadsense_login_otp_verified'

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [isAdmin, setIsAdmin] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        void supabase.auth.getSession().then(async ({ data: { session } }) => {
            const nextUser = session?.user ?? null
            setUser(nextUser)

            if (nextUser) {
                await loadProfile(nextUser.id)
                return
            }

            setProfile(null)
            setIsAdmin(false)
            setLoading(false)
        })

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            const nextUser = session?.user ?? null
            setUser(nextUser)

            if (nextUser) {
                void loadProfile(nextUser.id)
                return
            }

            setProfile(null)
            setIsAdmin(false)
            setLoading(false)
        })

        return () => subscription.unsubscribe()
    }, [])

    const isGoogleUser = useMemo(() => {
        if (!user) {
            return false
        }

        const providers = Array.isArray(user.app_metadata?.providers) ? user.app_metadata.providers : []
        return providers.includes('google') || user.app_metadata?.provider === 'google'
    }, [user])

    const requiresPasswordSetup = useMemo(() => {
        if (!user || !isGoogleUser) {
            return false
        }

        return user.user_metadata?.password_setup_completed !== true
    }, [isGoogleUser, user])

    const requiresLoginOtpVerification =
        Boolean(user)
        && typeof window !== 'undefined'
        && window.sessionStorage.getItem(LOGIN_METHOD_KEY) === 'password'
        && window.sessionStorage.getItem(LOGIN_OTP_VERIFIED_KEY) !== 'true'

    async function loadProfile(userId: string) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single()

            if (error) {
                throw error
            }

            setProfile(data as Profile)
            setIsAdmin(data?.role === 'admin')
        } catch (error) {
            console.error('Error loading profile:', error)
            setProfile(null)
            setIsAdmin(false)
        } finally {
            setLoading(false)
        }
    }

    async function signIn(email: string, password: string) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
            throw error
        }

        window.sessionStorage.setItem(LOGIN_METHOD_KEY, 'password')
        window.sessionStorage.setItem(LOGIN_OTP_VERIFIED_KEY, 'false')
    }

    async function signInWithGoogle() {
        window.sessionStorage.setItem(LOGIN_METHOD_KEY, 'google')
        window.sessionStorage.setItem(LOGIN_OTP_VERIFIED_KEY, 'true')
        const redirectTo = `${window.location.origin}/`
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo },
        })

        if (error) {
            throw error
        }
    }

    async function updatePassword(password: string) {
        const { data, error } = await supabase.auth.updateUser({
            password,
            data: {
                password_setup_completed: true,
            },
        })

        if (error) {
            throw error
        }

        if (data.user) {
            setUser(data.user)
        }
    }

    async function sendPasswordResetEmail(email: string) {
        const redirectTo = `${window.location.origin}/profile`
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })

        if (error) {
            throw error
        }
    }

    function markLoginOtpVerified() {
        window.sessionStorage.setItem(LOGIN_OTP_VERIFIED_KEY, 'true')
    }

    async function signOut() {
        setUser(null)
        setProfile(null)
        setIsAdmin(false)
        window.sessionStorage.removeItem(LOGIN_METHOD_KEY)
        window.sessionStorage.removeItem(LOGIN_OTP_VERIFIED_KEY)
        const { error } = await supabase.auth.signOut()
        if (error) {
            throw error
        }
    }

    async function refreshProfile() {
        if (!user) {
            setProfile(null)
            setIsAdmin(false)
            return
        }

        await loadProfile(user.id)
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                profile,
                isAdmin,
                loading,
                isGoogleUser,
                requiresPasswordSetup,
                requiresLoginOtpVerification,
                signIn,
                signInWithGoogle,
                sendPasswordResetEmail,
                updatePassword,
                markLoginOtpVerified,
                signOut,
                refreshProfile,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
