import { PredictionResult } from './tflite.service.web'

export interface CombinedReading {
    ax: number
    ay: number
    az: number
    gx: number
    gy: number
    gz: number
    timestamp: number
    latitude: number
    longitude: number
}

export type SensorSourceType = 'phone' | 'esp32'

export interface SensorSourceConfig {
    type: SensorSourceType
    websocketUrl?: string
}

export interface SensorStatus {
    source: SensorSourceType
    state: 'idle' | 'connecting' | 'streaming' | 'error'
    message: string
}

export class SensorService {
    constructor(
        private readonly onPrediction?: (prediction: PredictionResult) => void,
        private readonly onAnomaly?: (prediction: PredictionResult) => void,
        private readonly onReading?: (reading: CombinedReading) => void,
        private readonly onStatus?: (status: SensorStatus) => void
    ) {
        this.onPrediction = onPrediction
        this.onAnomaly = onAnomaly
        this.onReading = onReading
        this.onStatus = onStatus
    }

    async requestPermissions(): Promise<boolean> {
        return true
    }

    async initialize(): Promise<void> {
        this.onStatus?.({
            source: 'phone',
            state: 'idle',
            message: 'Web preview mode',
        })
    }

    async startCollection(_config?: SensorSourceConfig): Promise<void> {
        this.onStatus?.({
            source: 'phone',
            state: 'error',
            message: 'Motion inference is not available on web preview',
        })
    }

    stopCollection(): void {
        this.onStatus?.({
            source: 'phone',
            state: 'idle',
            message: 'Stopped',
        })
    }

    dispose(): void {}
}
