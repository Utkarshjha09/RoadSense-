import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useEffect, useState } from 'react'
import { supabase } from '../src/services/supabase.service'
import { router } from 'expo-router'

export default function HomeScreen() {
    const [user, setUser] = useState<any>(null)

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null)
            if (!session) {
                router.replace('/auth')
            }
        })

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null)
        })

        return () => subscription.unsubscribe()
    }, [])

    async function handleSignOut() {
        await supabase.auth.signOut()
        router.replace('/auth')
    }

    if (!user) return null

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>RoadSense</Text>
                <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
                    <Text style={styles.signOutText}>Sign Out</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.content}>
                <Text style={styles.welcome}>Welcome, {user.email}!</Text>

                <View style={styles.menu}>
                    <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/driving')}>
                        <Text style={styles.menuIcon}>🚗</Text>
                        <Text style={styles.menuTitle}>Start Driving</Text>
                        <Text style={styles.menuSubtitle}>Real-time pothole detection</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/logger')}>
                        <Text style={styles.menuIcon}>📊</Text>
                        <Text style={styles.menuTitle}>Data Logger</Text>
                        <Text style={styles.menuSubtitle}>Collect training data</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem} onPress={() => alert('Coming soon!')}>
                        <Text style={styles.menuIcon}>🗺️</Text>
                        <Text style={styles.menuTitle}>View Map</Text>
                        <Text style={styles.menuSubtitle}>See reported anomalies</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: 60,
        backgroundColor: '#1e293b',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    signOutButton: {
        padding: 8,
    },
    signOutText: {
        color: '#ef4444',
        fontSize: 14,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    welcome: {
        fontSize: 18,
        color: '#e2e8f0',
        marginBottom: 32,
    },
    menu: {
        gap: 16,
    },
    menuItem: {
        backgroundColor: '#1e293b',
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderColor: '#334155',
    },
    menuIcon: {
        fontSize: 32,
        marginBottom: 8,
    },
    menuTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 4,
    },
    menuSubtitle: {
        fontSize: 14,
        color: '#94a3b8',
    },
})
