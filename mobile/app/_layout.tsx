import { useCallback } from 'react'
import { View, StyleSheet } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as SplashScreen from 'expo-splash-screen'
import {
    useFonts,
    Exo2_700Bold,
    Exo2_800ExtraBold,
    Exo2_900Black,
} from '@expo-google-fonts/exo-2'
import {
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
} from '@expo-google-fonts/dm-sans'
import {
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
} from '@expo-google-fonts/jetbrains-mono'
import { theme } from '../src/theme'
import { BrandLoader } from '../components/brand-loader'

SplashScreen.preventAutoHideAsync().catch(() => {})

export default function RootLayout() {
    const [fontsLoaded] = useFonts({
        Exo2_700Bold,
        Exo2_800ExtraBold,
        Exo2_900Black,
        DMSans_400Regular,
        DMSans_500Medium,
        DMSans_600SemiBold,
        DMSans_700Bold,
        JetBrainsMono_400Regular,
        JetBrainsMono_500Medium,
    })

    const onLayoutRootView = useCallback(async () => {
        if (fontsLoaded) {
            await SplashScreen.hideAsync().catch(() => {})
        }
    }, [fontsLoaded])

    if (!fontsLoaded) {
        return (
            <View style={styles.loading}>
                <BrandLoader label="Loading RoadSense..." />
            </View>
        )
    }

    return (
        <SafeAreaProvider onLayout={() => void onLayoutRootView()}>
            <StatusBar style="light" />
            <Stack
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: theme.colors.bg },
                    animation: 'none',
                }}
            />
        </SafeAreaProvider>
    )
}

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.bg,
    },
})
