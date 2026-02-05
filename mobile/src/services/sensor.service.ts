import { accelerometer, gyroscope, setUpdateIntervalForType, SensorTypes } from 'react-native-sensors';
import { map, filter } from 'rxjs/operators';
import * as Location from 'expo-location';

// 50Hz = 20ms
const UPDATE_INTERVAL = 20;
setUpdateIntervalForType(SensorTypes.accelerometer, UPDATE_INTERVAL);
setUpdateIntervalForType(SensorTypes.gyroscope, UPDATE_INTERVAL);

export interface SensorReading {
    x: number;
    y: number;
    z: number;
    timestamp: number;
}

export interface CombinedReading {
    acc: SensorReading;
    gyro: SensorReading;
    timestamp: number;
    speed: number | null; // Speed in m/s
}

export class SensorService {
    private subscription: any = null;
    private buffer: CombinedReading[] = [];
    private readonly BUFFER_SIZE = 128;
    private isCollecting = false;
    private onBufferFull: (buffer: CombinedReading[]) => void;

    constructor(onBufferFull: (buffer: CombinedReading[]) => void) {
        this.onBufferFull = onBufferFull;
    }

    async requestPermissions() {
        const { status } = await Location.requestForegroundPermissionsAsync();
        return status === 'granted';
    }

    startCollection() {
        if (this.isCollecting) return;
        this.isCollecting = true;
        this.buffer = [];

        // Observe both sensors. 
        // Note: react-native-sensors observables emit individually. 
        // For simplicity in this demo, we might just subscribe to one and poll the other, 
        // or better, combine latest. However, they might not sync perfectly.
        // simpler approach for MVP: Subscribe to Acc, and get latest Gyro value.

        // Better approach: combineLatest from rxjs.
        // But for now, let's keep it simple. We can refine synchronization later.

        const stream = accelerometer.pipe(
            map(({ x, y, z, timestamp }) => ({ x, y, z, timestamp: Number(timestamp) }))
        );

        const gyroStream = gyroscope.pipe(
            map(({ x, y, z, timestamp }) => ({ x, y, z, timestamp: Number(timestamp) }))
        );

        // We actually need to merge these. 
        // In a real rigorous app we'd use zip or combineLatest with timestamp alignment.
        // For RoadSense v1, let's assume loose synchronization is okay or use combineLatest.
        // BUT, implementation detail: importing combineLatest might be tricky if not set up.
        // Let's grab them separately and push to buffer. 

        // Actually, let's just use the `subscribe` to acc, and maintain a `latestGyro` ref?
        // No, that introduces lag.

        // Let's try to use both.

        this.subscription = stream.subscribe(async (accData) => {
            // Mocking gyro for now if stream is complex, or ideally we subscribe to both.
            // Let's assume we have access to gyro. 
            // A common pattern in RN sensors is they fire independently.
            // We will implement a proper synchronized collector in Phase 3.
            // For Phase 2 Data Logger, let's just log Accelerometer for now 
            // or try to get both.

            // Let's rely on the calling component to handle subscriptions or 
            // expose the observables.

            // Redesigning this class to be a simple facade.
        });

        // Actually, I'll return the Observables and let the hook handle it?
        // Or I manage it here.
    }

    stopCollection() {
        this.isCollecting = false;
        if (this.subscription) {
            this.subscription.unsubscribe();
            this.subscription = null;
        }
    }
}

// Simple export for now, will refine in the UI hook
export const sensorConfig = {
    UPDATE_INTERVAL,
    BUFFER_SIZE: 128
};
