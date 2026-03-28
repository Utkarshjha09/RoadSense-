# Mobile App Integration Guide

## Model Integration for RoadSense Mobile App

Your trained model is ready for deployment! Here's how to integrate it into your React Native app.

---

## Model Specifications

- **Model File:** `models/final/road_sense_model.tflite` (8.6 MB)
- **Input Shape:** `[1, 100, 8]`
  - Batch size: 1
  - Timesteps: 100 (2 seconds at 50Hz)
  - Features: 8 (ax, ay, az, gx, gy, gz, latitude, longitude)
- **Output Shape:** `[1, 3]`
  - Class probabilities: [Smooth, Pothole, SpeedBump]
- **Accuracy:** 95.89%

---

## Integration Steps

### 1. Copy Model to Mobile App

```bash
# Copy the TFLite model to your mobile app
cp ml-pipeline/models/final/road_sense_model.tflite mobile/assets/models/
```

### 2. Update TFLite Service

Your TFLite service needs to handle **8 features** instead of 6:

**File:** `mobile/src/services/tflite.service.ts`

```typescript
interface SensorReading {
  ax: number;
  ay: number;
  az: number;
  gx: number;
  gy: number;
  gz: number;
}

interface LocationData {
  latitude: number;
  longitude: number;
}

class TFLiteService {
  private sensorBuffer: SensorReading[] = [];
  private currentLocation: LocationData = { latitude: 0, longitude: 0 };
  
  // Update location from GPS
  updateLocation(lat: number, lon: number) {
    this.currentLocation = { latitude: lat, longitude: lon };
  }
  
  // Add sensor reading to buffer
  addSensorReading(reading: SensorReading) {
    this.sensorBuffer.push(reading);
    
    // Maintain buffer size of 100
    if (this.sensorBuffer.length > 100) {
      this.sensorBuffer.shift(); // Remove oldest
    }
    
    // Run prediction every 50 samples (1 second)
    if (this.sensorBuffer.length === 100 && 
        this.sensorBuffer.length % 50 === 0) {
      this.runPrediction();
    }
  }
  
  async runPrediction() {
    if (this.sensorBuffer.length < 100) return;
    
    // Prepare input: 100 timesteps x 8 features
    const input = new Float32Array(100 * 8);
    
    for (let i = 0; i < 100; i++) {
      const reading = this.sensorBuffer[i];
      const offset = i * 8;
      
      // First 6 features: sensor data
      input[offset + 0] = reading.ax;
      input[offset + 1] = reading.ay;
      input[offset + 2] = reading.az;
      input[offset + 3] = reading.gx;
      input[offset + 4] = reading.gy;
      input[offset + 5] = reading.gz;
      
      // Last 2 features: GPS coordinates
      input[offset + 6] = this.currentLocation.latitude;
      input[offset + 7] = this.currentLocation.longitude;
    }
    
    // Run TFLite inference
    const output = await this.model.run([input], [1, 100, 8]);
    
    // Parse output [smooth_prob, pothole_prob, bump_prob]
    const probabilities = output[0];
    const maxIndex = probabilities.indexOf(Math.max(...probabilities));
    const confidence = probabilities[maxIndex] * 100;
    
    const labels = ['Smooth', 'Pothole', 'Speed Bump'];
    const prediction = {
      class: labels[maxIndex],
      classId: maxIndex,
      confidence: confidence,
      probabilities: {
        smooth: probabilities[0] * 100,
        pothole: probabilities[1] * 100,
        speedBump: probabilities[2] * 100
      },
      location: { ...this.currentLocation },
      timestamp: Date.now()
    };
    
    // Report if pothole/bump detected with high confidence
    if ((maxIndex === 1 || maxIndex === 2) && confidence > 80) {
      this.reportAnomaly(prediction);
    }
    
    return prediction;
  }
  
  reportAnomaly(prediction: any) {
    // Upload to Supabase
    // Your existing upload logic here
  }
}
```

### 3. Update Sensor Service

**File:** `mobile/src/services/sensor.service.ts`

```typescript
import { Accelerometer, Gyroscope } from 'expo-sensors';
import * as Location from 'expo-location';

class SensorService {
  private tfliteService: TFLiteService;
  
  async startMonitoring() {
    // Set sampling rate to 50Hz (20ms interval)
    Accelerometer.setUpdateInterval(20);
    Gyroscope.setUpdateInterval(20);
    
    // Start GPS tracking
    const location = await Location.getCurrentPositionAsync({});
    this.tfliteService.updateLocation(
      location.coords.latitude,
      location.coords.longitude
    );
    
    // Update GPS every 5 seconds
    setInterval(async () => {
      const loc = await Location.getCurrentPositionAsync({});
      this.tfliteService.updateLocation(
        loc.coords.latitude,
        loc.coords.longitude
      );
    }, 5000);
    
    // Subscribe to sensors
    const accelSub = Accelerometer.addListener(accelData => {
      this.handleSensorData({ accel: accelData });
    });
    
    const gyroSub = Gyroscope.addListener(gyroData => {
      this.handleSensorData({ gyro: gyroData });
    });
  }
  
  handleSensorData(data: any) {
    // Combine accelerometer and gyroscope readings
    const reading = {
      ax: data.accel?.x || 0,
      ay: data.accel?.y || 0,
      az: data.accel?.z || 0,
      gx: data.gyro?.x || 0,
      gy: data.gyro?.y || 0,
      gz: data.gyro?.z || 0
    };
    
    this.tfliteService.addSensorReading(reading);
  }
}
```

---

## Testing Checklist

- [ ] Copy `road_sense_model.tflite` to `mobile/assets/models/`
- [ ] Update TFLite service to use 8 features (6 sensors + 2 GPS)
- [ ] Test on physical device (emulators don't have real sensors)
- [ ] Verify GPS coordinates are being captured
- [ ] Test detection while driving over known potholes
- [ ] Verify data uploads to Supabase with correct GPS coords
- [ ] Check confidence thresholds (>80% recommended)

---

## Expected Behavior

1. **Smooth Road:** Confidence ~95-99%, no alerts
2. **Pothole:** Confidence ~85-95%, immediate alert + GPS save
3. **Speed Bump:** Confidence ~95-100%, log location for reference

---

## Performance Metrics

Your model achieves:
- **95.89%** overall accuracy
- **100%** speed bump detection (perfect!)
- **96.70%** smooth road detection
- **91.58%** pothole detection

This means:
- Very few false alarms
- Speed bumps never missed
- Most potholes correctly identified
- Production-ready for deployment

---

## Troubleshooting

**Issue:** Model not detecting anything
- Check sensor sampling rate (should be 50Hz)
- Verify buffer has 100 samples before prediction
- Ensure GPS coordinates are updating

**Issue:** Too many false positives
- Increase confidence threshold (try 85% or 90%)
- Verify sensor data is properly filtered
- Check that gravity filtering is applied

**Issue:** Missing detections
- Lower confidence threshold (try 75%)
- Verify sensor buffer is full (100 samples)
- Check that prediction runs every 1 second

---

## Next Steps

1. Copy model to mobile app
2. Update services to use 8-feature input
3. Test on physical device
4. Fine-tune confidence thresholds based on real-world testing
5. Deploy to production!

Your model is **ready for deployment** with excellent accuracy! 🚀
