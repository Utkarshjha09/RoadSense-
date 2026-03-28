export interface SensorReading {
  ax: number;
  ay: number;
  az: number;
  gx: number;
  gy: number;
  gz: number;
}

export interface LocationData {
  latitude: number;
  longitude: number;
}

export interface PredictionResult {
  className: string;
  classId: number;
  confidence: number;
  probabilities: {
    smooth: number;
    pothole: number;
    speedBump: number;
  };
  latitude: number;
  longitude: number;
  timestamp: number;
}

export class TFLiteService {
  async loadModel(): Promise<void> {
    return Promise.resolve();
  }

  updateLocation(_latitude: number, _longitude: number): void {}

  addSensorReading(_reading: SensorReading): void {}

  shouldRunPrediction(): boolean {
    return false;
  }

  async runPrediction(): Promise<PredictionResult | null> {
    return null;
  }

  reset(): void {}

  dispose(): void {}
}
