import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import * as Location from 'expo-location'
import { theme } from '../src/theme'

export default function DrivingWebScreen() {
    const [location, setLocation] = useState({ latitude: 28.6139, longitude: 77.209 })

    useEffect(() => {
        const loadLocation = async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync()
                if (status !== 'granted') {
                    return
                }

                const current = await Location.getCurrentPositionAsync({})
                setLocation({
                    latitude: current.coords.latitude,
                    longitude: current.coords.longitude,
                })
            } catch (error) {
                console.error('Web driving preview location failed:', error)
            }
        }

        void loadLocation()
    }, [])

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.hero}>
                <Text style={styles.kicker}>RoadSense Web</Text>
                <Text style={styles.title}>Driving Preview</Text>
                <Text style={styles.subtitle}>
                    Live sensor inference and on-device TFLite navigation are available in the Android build. The web route stays preview-only.
                </Text>
            </View>

            <View style={styles.panel}>
                <Text style={styles.sectionTitle}>Current Location</Text>
                <Text style={styles.value}>
                    {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                </Text>
            </View>

            <View style={styles.panel}>
                <Text style={styles.sectionTitle}>What To Use On Device</Text>
                <Text style={styles.copy}>Phone sensors or ESP32 stream</Text>
                <Text style={styles.copy}>Live pothole and speed-bump detection</Text>
                <Text style={styles.copy}>Route quality comparison and navigation guidance</Text>
            </View>

            <View style={styles.panel}>
                <Text style={styles.sectionTitle}>Web Preview Note</Text>
                <Text style={styles.copy}>
                    This screen intentionally avoids native sensor and model imports so cloud Android builds can bundle correctly.
                </Text>
            </View>
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.bg,
    },
    content: {
        padding: 16,
        gap: 12,
    },
    hero: {
        backgroundColor: theme.colors.panel,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 16,
        padding: 16,
    },
    kicker: {
        color: theme.colors.accent,
        textTransform: 'uppercase',
        letterSpacing: 2,
        fontWeight: '800',
        fontSize: 12,
    },
    title: {
        color: theme.colors.text,
        fontSize: 28,
        fontWeight: '800',
        marginTop: 8,
    },
    subtitle: {
        color: theme.colors.muted,
        marginTop: 8,
        lineHeight: 22,
        fontSize: 14,
    },
    panel: {
        backgroundColor: theme.colors.panel,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 16,
        padding: 16,
        gap: 8,
    },
    sectionTitle: {
        color: theme.colors.text,
        fontSize: 16,
        fontWeight: '800',
    },
    value: {
        color: theme.colors.text,
        fontSize: 18,
        fontWeight: '700',
    },
    copy: {
        color: theme.colors.muted,
        fontSize: 14,
        lineHeight: 21,
    },
})
