import { useEffect } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../src/services/supabase.service'

export default function Index() {
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                router.replace('/home')
            } else {
                router.replace('/auth')
            }
        })
    }, [])

    return (
        <View style={styles.container}>
            <ActivityIndicator size="large" color="#3b82f6" />
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
        justifyContent: 'center',
        alignItems: 'center',
    },
})
