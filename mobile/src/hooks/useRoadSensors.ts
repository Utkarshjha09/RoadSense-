import { useState, useEffect, useRef } from 'react'
import { Accelerometer, Gyroscope } from 'expo-sensors'
import { Subscription } from 'expo-sensors/build/DeviceSensor'

// Configuration
const SENSOR_FREQUENCY_HZ = 50 // 50Hz = 20ms interval
const UPDATE_INTERVAL_MS = 1000 / SENSOR_FREQUENCY_HZ // 20ms
const WINDOW_SIZE = 100 // 2 seconds at 50Hz
const STEP_SIZE = 50 // 50% overlap

// Low-pass filter for gravity isolation
const GRAVITY_ALPHA = 0.8

interface SensorData {
    ax: number
    ay: number
    az: number
    gx: number
    gy: number
    gz: number
    timestamp: number
}

interface SensorWindow {
    data: number[][] // [100, 6] array
    timestamp: number
}

export function useRoadSensors() {
    const [isActive, setIsActive] = useState(false)
    const [currentWindow, setCurrentWindow] = useState<SensorWindow | null>(null)
    const [sensorStats, setSensorStats] = useState({
        sampleCount: 0,
        windowCount: 0,
        frequency: 0,
    })

    // Refs for sensor data
    const buffer = useRef<SensorData[]>([])
    const gravity = useRef({ x: 0, y: 0, z: 0 })
    const subscriptions = useRef<Subscription[]>([])
    const lastTimestamp = useRef(Date.now())
    const sampleCounter = useRef(0)

    useEffect(() => {
        if (!isActive) return

        // Set sensor update intervals
        Accelerometer.setUpdateInterval(UPDATE_INTERVAL_MS)
        Gyroscope.setUpdateInterval(UPDATE_INTERVAL_MS)

        // Subscribe to accelerometer
        const accelSub = Accelerometer.addListener((accelData) => {
            const now = Date.now()

            // Apply low-pass filter to isolate gravity
            gravity.current.x = GRAVITY_ALPHA * gravity.current.x + (1 - GRAVITY_ALPHA) * accelData.x
            gravity.current.y = GRAVITY_ALPHA * gravity.current.y + (1 - GRAVITY_ALPHA) * accelData.y
            gravity.current.z = GRAVITY_ALPHA * gravity.current.z + (1 - GRAVITY_ALPHA) * accelData.z

            // Remove gravity to get user acceleration
            const userAccel = {
                ax: accelData.x - gravity.current.x,
                ay: accelData.y - gravity.current.y,
                az: accelData.z - gravity.current.z,
            }

            // Store temporarily (will be combined with gyro data)
            buffer.current.push({
                ...userAccel,
                gx: 0,
                gy: 0,
                gz: 0,
                timestamp: now,
            })

            sampleCounter.current++
        })

        // Subscribe to gyroscope
        const gyroSub = Gyroscope.addListener((gyroData) => {
            // Find the most recent accelerometer sample and add gyro data
            if (buffer.current.length > 0) {
                const lastSample = buffer.current[buffer.current.length - 1]
                lastSample.gx = gyroData.x
                lastSample.gy = gyroData.y
                lastSample.gz = gyroData.z

                // Check if we have enough samples for a window
                if (buffer.current.length >= WINDOW_SIZE) {
                    // Extract window
                    const windowData = buffer.current.slice(0, WINDOW_SIZE).map((sample) => [
                        sample.ax,
                        sample.ay,
                        sample.az,
                        sample.gx,
                        sample.gy,
                        sample.gz,
                    ])

                    // Create window object
                    const window: SensorWindow = {
                        data: windowData,
                        timestamp: Date.now(),
                    }

                    setCurrentWindow(window)

                    // Remove oldest samples (50% overlap)
                    buffer.current = buffer.current.slice(STEP_SIZE)

                    // Update stats
                    setSensorStats((prev) => ({
                        sampleCount: prev.sampleCount + STEP_SIZE,
                        windowCount: prev.windowCount + 1,
                        frequency: Math.round((sampleCounter.current / (Date.now() - lastTimestamp.current)) * 1000),
                    }))

                    sampleCounter.current = 0
                    lastTimestamp.current = Date.now()
                }
            }
        })

        subscriptions.current = [accelSub, gyroSub]

        // Cleanup
        return () => {
            subscriptions.current.forEach((sub) => sub.remove())
            subscriptions.current = []
        }
    }, [isActive])

    const start = () => {
        buffer.current = []
        gravity.current = { x: 0, y: 0, z: 0 }
        sampleCounter.current = 0
        lastTimestamp.current = Date.now()
        setIsActive(true)
    }

    const stop = () => {
        setIsActive(false)
        buffer.current = []
        setCurrentWindow(null)
    }

    return {
        isActive,
        currentWindow,
        sensorStats,
        start,
        stop,
    }
}
