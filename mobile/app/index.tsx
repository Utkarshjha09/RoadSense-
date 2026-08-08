import { useEffect, useState } from 'react'
import { router } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import { Navigation } from 'lucide-react-native'
import { theme } from '../src/theme'
import { getCurrentSession, requiresLoginOtpVerification } from '../src/services/mobile-auth.service'
import { BrandLoader } from '../components/brand-loader'

export default function Index() {
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState<string>('')

  useEffect(() => {
    initializeApp()
  }, [])

  const initializeApp = async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 500))

      try {
        const session = await getCurrentSession()
        const otpPending = await requiresLoginOtpVerification()

        if (session?.user && !otpPending) {
          router.replace('/home')
          return
        }
      } catch (supabaseError) {
        console.error('Supabase initialization failed:', supabaseError)
        setErrorMsg('Database connection issue')
      }

      router.replace('/auth')
    } catch (error: any) {
      console.error('Critical initialization error:', error)
      setStatus('error')
      setErrorMsg(error.message || 'Unknown error')

      setTimeout(() => {
        router.replace('/auth')
      }, 3000)
    }
  }

  if (status === 'error') {
    return (
      <View style={styles.container}>
        <View style={styles.glow} />
        <Text style={styles.errorTitle}>Initialization Error</Text>
        <Text style={styles.errorText}>{errorMsg}</Text>
        <Text style={styles.infoText}>Attempting to continue...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.glow} />
      <View style={styles.brandRow}>
        <View style={styles.brandIconWrap}>
          <Navigation size={24} color={theme.colors.accent} strokeWidth={1.5} />
        </View>
        <View>
          <Text style={styles.brandText}>
            Road<Text style={styles.brandTextAccent}>Sense</Text>
          </Text>
          <Text style={styles.brandKicker}>AI ROAD INTELLIGENCE</Text>
        </View>
      </View>
      <View style={styles.loaderSlot}>
        <BrandLoader label="Loading RoadSense..." />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.bg,
    padding: 20,
  },
  glow: {
    position: 'absolute',
    top: '28%',
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: 'rgba(34,211,238,0.09)',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 36,
  },
  brandIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(34,211,238,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  brandText: {
    fontFamily: theme.fonts.display,
    fontSize: 44,
    color: theme.colors.text,
    letterSpacing: -1,
  },
  brandTextAccent: {
    color: theme.colors.accent,
  },
  brandKicker: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 2.5,
    color: theme.colors.muted2,
    marginTop: 6,
  },
  loaderSlot: {
    marginTop: 8,
  },
  errorTitle: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 18,
    color: theme.colors.danger,
    marginBottom: 12,
  },
  errorText: {
    fontFamily: theme.fonts.body,
    fontSize: 14,
    color: theme.colors.muted,
    textAlign: 'center',
    marginBottom: 20,
  },
  infoText: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: theme.colors.muted,
  },
})
