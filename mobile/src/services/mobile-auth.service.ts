import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase.service'

WebBrowser.maybeCompleteAuthSession()

const LOGIN_METHOD_KEY = 'roadsense_mobile_login_method'
const LOGIN_OTP_VERIFIED_KEY = 'roadsense_mobile_login_otp_verified'

function getAuthRedirectUrl(queryParams?: Record<string, string>) {
    return Linking.createURL('auth', {
        scheme: 'roadsense',
        queryParams,
    })
}

export async function markPasswordLoginPending() {
    await AsyncStorage.multiSet([
        [LOGIN_METHOD_KEY, 'password'],
        [LOGIN_OTP_VERIFIED_KEY, 'false'],
    ])
}

export async function markLoginOtpVerified() {
    await AsyncStorage.setItem(LOGIN_OTP_VERIFIED_KEY, 'true')
}

export async function clearLoginState() {
    await AsyncStorage.multiRemove([LOGIN_METHOD_KEY, LOGIN_OTP_VERIFIED_KEY])
}

export async function requiresLoginOtpVerification() {
    const [[, method], [, otpVerified]] = await AsyncStorage.multiGet([
        LOGIN_METHOD_KEY,
        LOGIN_OTP_VERIFIED_KEY,
    ])

    return method === 'password' && otpVerified !== 'true'
}

export function isGoogleUser(user: User | null) {
    if (!user) {
        return false
    }

    const providers = Array.isArray(user.app_metadata?.providers) ? user.app_metadata.providers : []
    return providers.includes('google') || user.app_metadata?.provider === 'google'
}

export function requiresPasswordSetup(user: User | null) {
    return isGoogleUser(user) && user?.user_metadata?.password_setup_completed !== true
}

export async function signInWithGoogle() {
    const redirectTo = getAuthRedirectUrl()

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo,
            skipBrowserRedirect: true,
        },
    })

    if (error) {
        throw error
    }

    const authUrl = data?.url
    if (!authUrl) {
        throw new Error('Google auth URL was not returned by Supabase.')
    }

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectTo)

    if (result.type !== 'success' || !result.url) {
        throw new Error('Google sign-in was cancelled.')
    }

    const session = await exchangeSessionFromUrl(result.url)
    await AsyncStorage.multiSet([
        [LOGIN_METHOD_KEY, 'google'],
        [LOGIN_OTP_VERIFIED_KEY, 'true'],
    ])

    return session
}

export async function sendPasswordResetEmail(email: string) {
    const redirectTo = getAuthRedirectUrl({ mode: 'recovery' })
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) {
        throw error
    }
}

export async function exchangeSessionFromUrl(url: string) {
    const parsedUrl = new URL(url)
    const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''))
    const accessToken = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')

    if (!accessToken || !refreshToken) {
        throw new Error('Authentication tokens were not returned from Supabase.')
    }

    const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
    })

    if (error) {
        throw error
    }

    return data.session
}

export async function getCurrentSession() {
    const { data } = await supabase.auth.getSession()
    return data.session
}

export async function getCurrentUser() {
    const { data } = await supabase.auth.getUser()
    return data.user
}

export async function updatePassword(password: string) {
    const { data, error } = await supabase.auth.updateUser({
        password,
        data: {
            password_setup_completed: true,
        },
    })

    if (error) {
        throw error
    }

    return data.user
}

export function getRecoveryModeFromUrl(url: string | null) {
    if (!url) {
        return false
    }

    try {
        const parsedUrl = new URL(url)
        return parsedUrl.searchParams.get('mode') === 'recovery'
    } catch {
        return false
    }
}

export async function loadSessionFromDeepLink(url: string | null) {
    if (!url) {
        return { session: null as Session | null, isRecovery: false }
    }

    const session = await exchangeSessionFromUrl(url)
    return {
        session,
        isRecovery: getRecoveryModeFromUrl(url),
    }
}
