import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { accelerometer, gyroscope, setUpdateIntervalForType, SensorTypes } from 'react-native-sensors';
import { Stack } from 'expo-router';
import * as Location from 'expo-location';

// Configure Sensor Interval
const UPDATE_INTERVAL = 20; // 20ms = 50Hz
setUpdateIntervalForType(SensorTypes.accelerometer, UPDATE_INTERVAL);
setUpdateIntervalForType(SensorTypes.gyroscope, UPDATE_INTERVAL);

export default function DataLogger() {
    const [isRecording, setIsRecording] = useState(false);
    const [accData, setAccData] = useState({ x: 0, y: 0, z: 0 });
    const [gyroData, setGyroData] = useState({ x: 0, y: 0, z: 0 });
    const [speed, setSpeed] = useState(0);
    const subscriptionAcc = useRef(null);
    const subscriptionGyro = useRef(null);

    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                console.log('Permission to access location was denied');
                return;
            }
        })();

        return () => {
            stopSensors();
        };
    }, []);

    const startSensors = () => {
        setIsRecording(true);

        subscriptionAcc.current = accelerometer.subscribe(({ x, y, z }) => {
            setAccData({ x, y, z });
        });

        subscriptionGyro.current = gyroscope.subscribe(({ x, y, z }) => {
            setGyroData({ x, y, z });
        });

        // Monitor speed
        Location.watchPositionAsync({
            accuracy: Location.Accuracy.High,
            timeInterval: 1000,
            distanceInterval: 1
        }, (loc) => {
            setSpeed(loc.coords.speed || 0); // speed in m/s
        });
    };

    const stopSensors = () => {
        setIsRecording(false);
        subscriptionAcc.current?.unsubscribe();
        subscriptionGyro.current?.unsubscribe();
    };

    const toggleRecording = () => {
        if (isRecording) {
            stopSensors();
        } else {
            startSensors();
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: 'Data Logger', headerStyle: { backgroundColor: '#1a2332' }, headerTintColor: '#fff' }} />

            <View style={styles.card}>
                <Text style={styles.label}>Accelerometer (g)</Text>
                <Text style={styles.value}>X: {accData.x.toFixed(3)}</Text>
                <Text style={styles.value}>Y: {accData.y.toFixed(3)}</Text>
                <Text style={styles.value}>Z: {accData.z.toFixed(3)}</Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.label}>Gyroscope (rad/s)</Text>
                <Text style={styles.value}>X: {gyroData.x.toFixed(3)}</Text>
                <Text style={styles.value}>Y: {gyroData.y.toFixed(3)}</Text>
                <Text style={styles.value}>Z: {gyroData.z.toFixed(3)}</Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.label}>GPS Speed</Text>
                <Text style={styles.value}>{(speed * 3.6).toFixed(1)} km/h</Text>
            </View>

            <TouchableOpacity
                style={[styles.button, isRecording ? styles.stopBtn : styles.startBtn]}
                onPress={toggleRecording}
            >
                <Text style={styles.btnText}>{isRecording ? 'STOP LOGGING' : 'START LOGGING'}</Text>
            </TouchableOpacity>

            <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                    Note: This device is currently in <Text style={{ fontWeight: 'bold' }}>Collection Mode</Text>.
                    Data is being read at 50Hz.
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0d1117',
        padding: 20,
        alignItems: 'center',
    },
    card: {
        backgroundColor: '#1a2332',
        width: '100%',
        padding: 15,
        borderRadius: 10,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#30363d',
    },
    label: {
        color: '#8b949e',
        fontSize: 14,
        marginBottom: 5,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    value: {
        color: '#ffffff',
        fontSize: 18,
        fontFamily: 'monospace',
    },
    button: {
        width: '100%',
        padding: 18,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 20,
    },
    startBtn: {
        backgroundColor: '#238636', // Green
    },
    stopBtn: {
        backgroundColor: '#da3633', // Red
    },
    btnText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    infoBox: {
        marginTop: 30,
        padding: 10,
    },
    infoText: {
        color: '#8b949e',
        textAlign: 'center',
    }
});
