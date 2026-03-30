/**
 * Sensor Service for RoadSense
 * Collects IMU data from either the phone or an ESP32 stream at 50Hz.
 * GPS remains app-side so detections stay geotagged.
 */

import { accelerometer, gyroscope, setUpdateIntervalForType, SensorTypes } from 'react-native-sensors';
import { combineLatest, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system/legacy';
import type { PredictionResult } from './tflite.service';
import { buildCloudEvent, CloudSensorEvent, fetchLatestPredictions, flushOfflineEvents, isCloudApiConfigured, submitLiveEvents } from './cloud-api.service';

const UPDATE_INTERVAL = 20;
setUpdateIntervalForType(SensorTypes.accelerometer, UPDATE_INTERVAL);
setUpdateIntervalForType(SensorTypes.gyroscope, UPDATE_INTERVAL);

export interface CombinedReading {
    ax: number;
    ay: number;
    az: number;
    gx: number;
    gy: number;
    gz: number;
    timestamp: number;
    latitude: number;
    longitude: number;
}

export type SensorSourceType = 'phone' | 'esp32';

export interface SensorSourceConfig {
    type: SensorSourceType;
    websocketUrl?: string;
}

export interface SensorStatus {
    source: SensorSourceType;
    state: 'idle' | 'connecting' | 'streaming' | 'error';
    message: string;
}

interface Esp32Payload {
    ax?: number;
    ay?: number;
    az?: number;
    gx?: number;
    gy?: number;
    gz?: number;
    latitude?: number;
    longitude?: number;
    timestamp?: number;
}

export class SensorService {
    private subscription: Subscription | null = null;
    private locationSubscription: ReturnType<typeof setInterval> | null = null;
    private esp32Socket: WebSocket | null = null;
    private isCollecting = false;
    private readonly onPrediction?: (prediction: PredictionResult) => void;
    private readonly onAnomaly?: (prediction: PredictionResult) => void;
    private readonly onReading?: (reading: CombinedReading) => void;
    private readonly onStatus?: (status: SensorStatus) => void;
    private currentLocation = { latitude: 0, longitude: 0 };
    private currentSource: SensorSourceType = 'phone';
    private logFileUri: string | null = null;
    private logBuffer: string[] = [];
    private cloudBuffer: CloudSensorEvent[] = [];
    private cloudSyncInterval: ReturnType<typeof setInterval> | null = null;
    private cloudFlushInProgress = false;
    private currentDeviceId: string | null = null;
    private lastHandledPredictionEventId: string | null = null;
    private lastQueueWarningAt = 0;
    private lastQueueWarningMessage = '';

    constructor(
        onPrediction?: (prediction: PredictionResult) => void,
        onAnomaly?: (prediction: PredictionResult) => void,
        onReading?: (reading: CombinedReading) => void,
        onStatus?: (status: SensorStatus) => void
    ) {
        this.onPrediction = onPrediction;
        this.onAnomaly = onAnomaly;
        this.onReading = onReading;
        this.onStatus = onStatus;
    }

    async requestPermissions(): Promise<boolean> {
        const { status } = await Location.requestForegroundPermissionsAsync();
        return status === 'granted';
    }

    async initialize(): Promise<void> {
        if (!isCloudApiConfigured) {
            throw new Error('Set EXPO_PUBLIC_CLOUD_API_URL or EXPO_PUBLIC_API_BASE_URL.');
        }
    }

    private emitStatus(state: SensorStatus['state'], message: string): void {
        this.onStatus?.({
            source: this.currentSource,
            state,
            message,
        });
    }

    private async startLocationTracking(): Promise<void> {
        try {
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            this.currentLocation = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            };
        } catch (error) {
            console.warn('Could not get initial location:', error);
        }

        this.locationSubscription = setInterval(async () => {
            try {
                const location = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });
                this.currentLocation = {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                };
            } catch (error) {
                console.warn('Location update failed:', error);
            }
        }, 5000);
    }

    private normalizeEsp32Reading(payload: Esp32Payload): CombinedReading {
        return {
            ax: Number(payload.ax ?? 0),
            ay: Number(payload.ay ?? 0),
            az: Number(payload.az ?? 0),
            gx: Number(payload.gx ?? 0),
            gy: Number(payload.gy ?? 0),
            gz: Number(payload.gz ?? 0),
            timestamp: Number(payload.timestamp ?? Date.now()),
            latitude: Number(payload.latitude ?? this.currentLocation.latitude),
            longitude: Number(payload.longitude ?? this.currentLocation.longitude),
        };
    }

    private async initCsvLogger(): Promise<void> {
        try {
            const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
            if (!baseDir) return;

            this.logFileUri = `${baseDir}roadsense_live_${Date.now()}.csv`;
            const header =
                'timestamp,source,ax,ay,az,gx,gy,gz,latitude,longitude,prediction_class,prediction_confidence\n';
            await FileSystem.writeAsStringAsync(this.logFileUri, header);
            this.logBuffer = [];
            console.log(`CSV logger started: ${this.logFileUri}`);
        } catch (error) {
            console.warn('Could not initialize CSV logger:', error);
            this.logFileUri = null;
        }
    }

    private queueLogRow(row: string): void {
        this.logBuffer.push(row);
    }

    private async flushLogs(): Promise<void> {
        if (!this.logFileUri || this.logBuffer.length === 0) {
            return;
        }

        const chunk = this.logBuffer.join('');
        this.logBuffer = [];
        try {
            await FileSystem.writeAsStringAsync(this.logFileUri, chunk, {
                encoding: FileSystem.EncodingType.UTF8,
                append: true,
            } as any);
        } catch (error) {
            console.warn('CSV flush failed:', error);
        }
    }

    private async processReading(reading: CombinedReading): Promise<void> {
        this.onReading?.(reading);

        void this.queueCloudReading(reading);

        if (reading.latitude !== 0 || reading.longitude !== 0) {
            this.currentLocation = {
                latitude: reading.latitude,
                longitude: reading.longitude,
            };
        }

        this.queueLogRow(
            `${reading.timestamp},${this.currentSource},${reading.ax},${reading.ay},${reading.az},${reading.gx},${reading.gy},${reading.gz},${reading.latitude},${reading.longitude},,\n`
        );
        if (this.logBuffer.length >= 40) {
            await this.flushLogs();
        }
    }

    private async queueCloudReading(reading: CombinedReading): Promise<void> {
        if (!isCloudApiConfigured) {
            return;
        }
        try {
            const event = await buildCloudEvent(this.currentSource, reading);
            this.currentDeviceId = event.device_id;
            this.cloudBuffer.push(event);
            if (this.cloudBuffer.length >= 50) {
                await this.flushCloudBuffer();
            }
        } catch (error) {
            console.warn('Cloud event queue failed:', error);
        }
    }

    private async flushCloudBuffer(): Promise<void> {
        if (this.cloudFlushInProgress || this.cloudBuffer.length === 0) {
            return;
        }
        this.cloudFlushInProgress = true;
        try {
            const batch = [...this.cloudBuffer];
            this.cloudBuffer = [];
            const result = await submitLiveEvents(batch);
            if (result.queueError) {
                const now = Date.now();
                const warningChanged = result.queueError !== this.lastQueueWarningMessage;
                const cooldownElapsed = now - this.lastQueueWarningAt > 30000;
                if (warningChanged || cooldownElapsed) {
                    console.warn(`Cloud queue warning: ${result.queueError}`);
                    this.lastQueueWarningAt = now;
                    this.lastQueueWarningMessage = result.queueError;
                    this.emitStatus('error', `Cloud upload issue: ${result.queueError}`);
                }
            }
            if (result.success) {
                if (this.lastQueueWarningMessage) {
                    this.lastQueueWarningMessage = '';
                    this.emitStatus('streaming', this.currentSource === 'phone' ? 'Using phone motion sensors' : 'Using ESP32 stream');
                }
                await flushOfflineEvents();
                await this.pullLatestCloudPrediction();
            }
        } catch (error) {
            console.warn('Cloud flush failed:', error);
        } finally {
            this.cloudFlushInProgress = false;
        }
    }

    private async pullLatestCloudPrediction(): Promise<void> {
        if (!this.currentDeviceId) return;
        const items = await fetchLatestPredictions(30);
        const latest = items.find((item) => item.device_id === this.currentDeviceId);
        if (!latest || latest.event_id === this.lastHandledPredictionEventId) {
            return;
        }
        this.lastHandledPredictionEventId = latest.event_id;

        const classId = latest.predicted_type === 'POTHOLE' ? 1 : latest.predicted_type === 'SPEED_BUMP' ? 2 : 0;
        const className = classId === 1 ? 'Pothole' : classId === 2 ? 'Speed Bump' : 'Smooth';
        const confidence = Math.max(0, Math.min(100, latest.confidence * 100));
        const prediction: PredictionResult = {
            classId,
            className,
            confidence,
            probabilities: {
                smooth: classId === 0 ? confidence : 0,
                pothole: classId === 1 ? confidence : 0,
                speedBump: classId === 2 ? confidence : 0,
            },
            latitude: Number(latest.lat || this.currentLocation.latitude),
            longitude: Number(latest.lng || this.currentLocation.longitude),
            timestamp: Date.parse(latest.created_at) || Date.now(),
        };

        this.onPrediction?.(prediction);
        if ((prediction.classId === 1 || prediction.classId === 2) && prediction.confidence > 60) {
            this.onAnomaly?.(prediction);
        }
    }

    private startPhoneSensorStream(): void {
        const accelStream = accelerometer.pipe(
            map(({ x, y, z, timestamp }) => ({
                ax: x,
                ay: y,
                az: z,
                timestamp: Number(timestamp),
            }))
        );

        const gyroStream = gyroscope.pipe(
            map(({ x, y, z, timestamp }) => ({
                gx: x,
                gy: y,
                gz: z,
                timestamp: Number(timestamp),
            }))
        );

        this.subscription = combineLatest([accelStream, gyroStream])
            .pipe(
                map(([accel, gyro]) => ({
                    ax: accel.ax,
                    ay: accel.ay,
                    az: accel.az,
                    gx: gyro.gx,
                    gy: gyro.gy,
                    gz: gyro.gz,
                    timestamp: accel.timestamp,
                    latitude: this.currentLocation.latitude,
                    longitude: this.currentLocation.longitude,
                }))
            )
            .subscribe({
                next: (reading: CombinedReading) => {
                    this.emitStatus('streaming', 'Using phone motion sensors');
                    void this.processReading(reading);
                },
                error: (error: unknown) => {
                    console.error('Phone sensor stream failed:', error);
                    this.emitStatus('error', 'Phone sensor stream failed');
                },
            });
    }

    private startEsp32Stream(websocketUrl?: string): void {
        if (!websocketUrl) {
            throw new Error('ESP32 mode requires a WebSocket URL');
        }

        this.emitStatus('connecting', `Connecting to ${websocketUrl}`);
        this.esp32Socket = new WebSocket(websocketUrl);

        this.esp32Socket.onopen = () => {
            this.emitStatus('streaming', `Streaming from ${websocketUrl}`);
        };

        this.esp32Socket.onmessage = (event) => {
            try {
                const payload = JSON.parse(String(event.data)) as Esp32Payload;
                const reading = this.normalizeEsp32Reading(payload);
                void this.processReading(reading);
            } catch (error) {
                console.error('Invalid ESP32 sensor payload:', error);
                this.emitStatus('error', 'Received invalid JSON from ESP32');
            }
        };

        this.esp32Socket.onerror = () => {
            this.emitStatus('error', 'ESP32 socket error');
        };

        this.esp32Socket.onclose = () => {
            this.emitStatus(this.isCollecting ? 'error' : 'idle', this.isCollecting ? 'ESP32 connection closed' : 'ESP32 stream stopped');
        };
    }

    async startCollection(sourceConfig: SensorSourceConfig = { type: 'phone' }): Promise<void> {
        if (this.isCollecting) {
            return;
        }

        this.currentSource = sourceConfig.type;
        this.isCollecting = true;
        this.lastHandledPredictionEventId = null;
        this.cloudBuffer = [];
        await this.initCsvLogger();
        this.emitStatus('connecting', sourceConfig.type === 'phone' ? 'Preparing phone sensors' : 'Preparing ESP32 stream');

        if (isCloudApiConfigured) {
            void flushOfflineEvents();
            this.cloudSyncInterval = setInterval(() => {
                void this.flushCloudBuffer();
                void flushOfflineEvents();
            }, 15000);
        }

        await this.startLocationTracking();

        if (sourceConfig.type === 'esp32') {
            this.startEsp32Stream(sourceConfig.websocketUrl);
            return;
        }

        this.startPhoneSensorStream();
    }

    async stopCollection(): Promise<void> {
        this.isCollecting = false;

        if (this.subscription) {
            this.subscription.unsubscribe();
            this.subscription = null;
        }

        if (this.locationSubscription) {
            clearInterval(this.locationSubscription);
            this.locationSubscription = null;
        }

        if (this.esp32Socket) {
            this.esp32Socket.close();
            this.esp32Socket = null;
        }

        if (this.cloudSyncInterval) {
            clearInterval(this.cloudSyncInterval);
            this.cloudSyncInterval = null;
        }

        void this.flushLogs();
        await this.flushCloudBuffer();
        await flushOfflineEvents();
        this.emitStatus('idle', 'Sensor collection stopped');
    }

    dispose(): void {
        void this.stopCollection();
    }
}

export const sensorConfig = {
    UPDATE_INTERVAL,
    BUFFER_SIZE: 128,
};
