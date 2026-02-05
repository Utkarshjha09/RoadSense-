import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { useState } from 'react'
import { supabase } from '../src/services/supabase.service'
import { router } from 'expo-router'

export default function AuthScreen() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [isSignUp, setIsSignUp] = useState(false)

    async function handleAuth() {
        setLoading(true)
        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({ email, password })
                if (error) throw error
                alert('Check your email for verification link!')
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password })
                if (error) throw error
                router.replace('/home')
            }
        } catch (error: any) {
            alert(error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.card}>
                <Text style={styles.title}>RoadSense</Text>
                <Text style={styles.subtitle}>Crowdsourced Road Quality Monitoring</Text>

                <View style={styles.form}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="you@example.com"
                        placeholderTextColor="#64748b"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />

                    <Text style={styles.label}>Password</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="••••••••"
                        placeholderTextColor="#64748b"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleAuth}
                        disabled={loading}
                    >
                        <Text style={styles.buttonText}>{loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)} style={styles.switchButton}>
                        <Text style={styles.switchText}>
                            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
        justifyContent: 'center',
        padding: 20,
    },
    card: {
        backgroundColor: '#1e293b',
        borderRadius: 16,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#94a3b8',
        textAlign: 'center',
        marginBottom: 32,
    },
    form: {
        gap: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#e2e8f0',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#334155',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: '#fff',
        borderWidth: 1,
        borderColor: '#475569',
    },
    button: {
        backgroundColor: '#3b82f6',
        borderRadius: 8,
        padding: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    switchButton: {
        marginTop: 16,
        alignItems: 'center',
    },
    switchText: {
        color: '#3b82f6',
        fontSize: 14,
    },
})
