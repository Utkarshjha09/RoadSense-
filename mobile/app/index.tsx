import { useEffect, useState } from 'react'
import { router } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
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
        <Text style={styles.errorTitle}>Initialization Error</Text>
        <Text style={styles.errorText}>{errorMsg}</Text>
        <Text style={styles.infoText}>Attempting to continue...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <BrandLoader label="Loading RoadSense..." />
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
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.danger,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    color: theme.colors.muted,
    textAlign: 'center',
    marginBottom: 20,
  },
  infoText: {
    fontSize: 12,
    color: theme.colors.muted,
  },
})
