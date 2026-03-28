/**
 * TFLite Service for RoadSense
 * Handles model loading and inference with 8 features (sensors + GPS)
 * Model: road_sense_model.tflite (100 timesteps x 8 features)
 */

import { loadTensorflowModel, TensorflowModel } from 'react-native-fast-tflite';

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

const LABELS = ['Smooth', 'Pothole', 'Speed Bump'];
const WINDOW_SIZE = 100; // 2 seconds at 50Hz
const PREDICTION_INTERVAL = 50; // Run prediction every 50 samples (1 second)
const MODEL_SOURCE = require('./road_sense_model.tflite');

export class TFLiteService {
  private model: TensorflowModel | null = null;
  private sensorBuffer: SensorReading[] = [];
  private currentLocation: LocationData = { latitude: 0, longitude: 0 };
  private sampleCount = 0;

  /**
   * Load the TFLite model
   */
  async loadModel(): Promise<void> {
    try {
      console.log('Starting model load...');
      // react-native-fast-tflite resolves bundled .tflite assets from require(...)
      this.model = await loadTensorflowModel(MODEL_SOURCE);
      console.log('TFLite model loaded successfully');
    } catch (error) {
      console.error('Error loading TFLite model:', error);
      throw new Error(`Failed to load model: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update GPS location
   */
  updateLocation(latitude: number, longitude: number): void {
    this.currentLocation = { latitude, longitude };
  }

  /**
   * Add sensor reading to buffer
   */
  addSensorReading(reading: SensorReading): void {
    this.sensorBuffer.push(reading);
    this.sampleCount++;

    // Maintain buffer size of 100
    if (this.sensorBuffer.length > WINDOW_SIZE) {
      this.sensorBuffer.shift(); // Remove oldest
    }
  }

  /**
   * Check if ready to run prediction
   */
  shouldRunPrediction(): boolean {
    const ready = this.sensorBuffer.length === WINDOW_SIZE &&
      this.sampleCount % PREDICTION_INTERVAL === 0;
    
    if (this.sampleCount % 250 === 0) { // Log every 5 seconds
      console.log(`Buffer: ${this.sensorBuffer.length}/${WINDOW_SIZE}, Samples: ${this.sampleCount}`);
    }
    
    return ready;
  }

  /**
   * Run inference on current buffer
   */
  async runPrediction(): Promise<PredictionResult | null> {
    if (!this.model) {
      console.warn('Model not loaded');
      return null;
    }

    if (this.sensorBuffer.length < WINDOW_SIZE) {
      console.warn('Buffer not full yet:', this.sensorBuffer.length);
      return null;
    }

    try {
      // Prepare input: 100 timesteps x 8 features
      const input = new Float32Array(WINDOW_SIZE * 8);

      for (let i = 0; i < WINDOW_SIZE; i++) {
        const reading = this.sensorBuffer[i];
        const offset = i * 8;

        // First 6 features: sensor data
        input[offset + 0] = reading.ax;
        input[offset + 1] = reading.ay;
        input[offset + 2] = reading.az;
        input[offset + 3] = reading.gx;
        input[offset + 4] = reading.gy;
        input[offset + 5] = reading.gz;

        // Last 2 features: GPS coordinates (normalized)
        input[offset + 6] = this.currentLocation.latitude;
        input[offset + 7] = this.currentLocation.longitude;
      }

      // Run inference
      const output = await this.model.run([input]);

      // Parse output [smooth_prob, pothole_prob, bump_prob]
      const probabilities = Array.from(output[0] as Float32Array);

      const maxIndex = probabilities.indexOf(Math.max(...probabilities));
      const confidence = probabilities[maxIndex] * 100;

      const result: PredictionResult = {
        className: LABELS[maxIndex],
        classId: maxIndex,
        confidence,
        probabilities: {
          smooth: probabilities[0] * 100,
          pothole: probabilities[1] * 100,
          speedBump: probabilities[2] * 100,
        },
        latitude: this.currentLocation.latitude,
        longitude: this.currentLocation.longitude,
        timestamp: Date.now(),
      };

      return result;
    } catch (error) {
      console.error('Prediction error:', error);
      return null;
    }
  }

  /**
   * Reset buffer (useful when starting a new session)
   */
  reset(): void {
    this.sensorBuffer = [];
    this.sampleCount = 0;
  }

  /**
   * Cleanup
   */
  dispose(): void {
    if (this.model) {
      try {
        // Note: TensorflowModel doesn't have a dispose method in react-native-fast-tflite
        // Just null it out to allow garbage collection
        this.model = null;
      } catch (error) {
        console.warn('Error disposing model:', error);
      }
    }
    this.reset();
  }
}
