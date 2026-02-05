import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Link } from 'expo-router';

export default function HomeScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>RoadSense</Text>
            <Text style={styles.subtitle}>Road Quality Monitoring</Text>

            <View style={styles.menu}>
                <Link href="/logger" asChild>
                    <TouchableOpacity style={styles.button}>
                        <Text style={styles.buttonText}>Data Logger (Dev)</Text>
                    </TouchableOpacity>
                </Link>

                <TouchableOpacity style={[styles.button, styles.disabled]} disabled>
                    <Text style={styles.buttonText}>Start Monitoring (Coming Soon)</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a2332', // Navy Blue
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#e67e50', // Accent Orange
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 18,
        color: '#ccc',
        marginBottom: 50,
    },
    menu: {
        width: '100%',
        gap: 15,
    },
    button: {
        backgroundColor: '#e67e50',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
    },
    disabled: {
        backgroundColor: '#555',
        opacity: 0.7,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
