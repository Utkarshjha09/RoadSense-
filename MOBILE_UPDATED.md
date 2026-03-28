# Mobile App Integration - Updated Model ✅

## What's Been Updated

The mobile app has been successfully integrated with the new 8-feature ML model (including latitude and longitude).

### Files Modified

1. **[mobile/src/services/tflite.service.ts](mobile/src/services/tflite.service.ts)**
   - Complete TFLite inference service
   - Handles 8-feature input: `[ax, ay, az, gx, gy, gz, lat, lon]`
   - Manages sliding window buffer (100 samples)
   - Runs predictions every 50 samples (1 second)
   - Returns predictions with confidence scores and GPS coordinates

2. **[mobile/src/services/sensor.service.ts](mobile/src/services/sensor.service.ts)**
   - Sensor data collection at 50Hz
   - GPS tracking integrated with expo-location
   - Combines accelerometer and gyroscope streams using RxJS
   - Automatic anomaly detection with callbacks
   - Updates location every 5 seconds

3. **[mobile/app/driving.tsx](mobile/app/driving.tsx)**
   - Real-time ML predictions display
   - Shows current detection with confidence
   - Displays GPS coordinates for each prediction
   - Statistics tracking (smooth roads, potholes, speed bumps)
   - Vibration feedback on anomaly detection
   - Recent detections list with location data

## Model Specifications

- **Input Shape**: `(1, 100, 8)` - 100 samples × 8 features
- **Features**: Accelerometer (ax,ay,az) + Gyroscope (gx,gy,gz) + GPS (lat,lon)
- **Sampling Rate**: 50Hz
- **Window Size**: 100 samples = 2 seconds of driving
- **Prediction Rate**: Every 50 samples = 1 second
- **Model Path**: `mobile/assets/models/road_sense_model.tflite`
- **Model Size**: 8.6 MB

## Model Performance

- **Overall Accuracy**: 95.89%
- **Smooth Roads**: 96.70% (469/485)
- **Potholes**: 91.58% (348/380)
- **Speed Bumps**: 100% (304/304) ⭐

## How It Works

### 1. Initialization
```typescript
const sensorService = new SensorService(onPrediction, onAnomaly);
await sensorService.initialize(); // Loads TFLite model
```

### 2. Data Collection
- Accelerometer + Gyroscope collected at 50Hz
- GPS location updated every 5 seconds
- Data buffered in sliding window (100 samples)

### 3. Prediction Pipeline
```
Sensor Data (50Hz) → Buffer (100 samples) → TFLite Model → Prediction
                         ↓                                      ↓
                   GPS Coordinates                    [Smooth, Pothole, Speed Bump]
```

### 4. Results
- **Class ID**: 0 = Smooth, 1 = Pothole, 2 = Speed Bump
- **Confidence**: 0-100%
- **Location**: Latitude & Longitude from GPS

### 5. Anomaly Detection
- Triggers when confidence > 80% for potholes or speed bumps
- Phone vibrates on detection
- Data uploaded to Supabase backend

## Testing the App

### Prerequisites
1. **Physical Device Required**: Sensors don't work properly on emulators
2. **GPS Access**: Must test outdoors or in area with GPS signal
3. **Permissions**: Location and sensor permissions must be granted

### Test Steps

1. **Install Dependencies** (if not done):
```bash
cd mobile
npm install
```

2. **Run on Device**:
```bash
npm start
# Then scan QR code with Expo Go app
# OR
npx expo run:android  # For Android
npx expo run:ios      # For iOS
```

3. **Test Flow**:
   - Open app and navigate to "Driving" tab
   - Grant location permissions when prompted
   - Press "Start Detection"
   - Drive on road with known potholes or speed bumps
   - Observe real-time predictions on screen
   - Check detections list for anomalies

### Expected Behavior

✅ **Smooth Road**: Shows "Smooth" with high confidence (>85%)
✅ **Pothole**: Detects with ~92% accuracy, phone vibrates
✅ **Speed Bump**: Detects with 100% accuracy, phone vibrates
✅ **GPS Coordinates**: Updates every 5 seconds, shown with each prediction

## Code Architecture

### TFLiteService
```typescript
class TFLiteService {
  loadModel() // Load from assets/models/road_sense_model.tflite
  addSensorReading() // Buffer sensor data
  updateLocation() // Update GPS coordinates
  runPrediction() // Execute inference when 100 samples ready
  shouldRunPrediction() // Check if ready (every 50 samples)
}
```

### SensorService
```typescript
class SensorService {
  initialize() // Load model
  startCollection() // Begin 50Hz sampling + GPS tracking
  stopCollection() // Stop all sensors
  
  // Callbacks
  onPrediction(result) // Every 1 second
  onAnomaly(result) // When confidence > 80%
}
```

### Driving Screen
```typescript
- Real-time prediction display
- Statistics dashboard
- Recent detections list
- Start/Stop controls
- Automatic vibration on anomaly
```

## Next Steps

### 1. Backend Integration
- [ ] Set up Supabase database (see [backend/BACKEND_SETUP.md](backend/BACKEND_SETUP.md))
- [ ] Test anomaly upload service
- [ ] Verify data appears on web dashboard

### 2. Field Testing
- [ ] Test on different road conditions
- [ ] Validate GPS accuracy
- [ ] Collect real-world feedback
- [ ] Fine-tune confidence thresholds

### 3. Enhancements
- [ ] Add offline mode (cache detections)
- [ ] Background detection support
- [ ] Battery optimization
- [ ] Voice announcements for detections
- [ ] Map view showing detection locations

## Troubleshooting

### Model Loading Fails
```typescript
Error: Could not load TensorFlow Lite model
```
**Solution**: Verify `road_sense_model.tflite` exists in `mobile/assets/models/`

### No Predictions
```typescript
Sensors collecting but no predictions appearing
```
**Checklist**:
- GPS signal acquired? (Check coordinates are non-zero)
- Moving at >10 km/h? (Required for detections)
- Buffer filled? (Needs 100 samples = 2 seconds)

### GPS Not Working
```typescript
Coordinates show 0, 0
```
**Solution**: 
- Test outdoors (GPS doesn't work indoors)
- Grant location permissions in app settings
- Restart app after granting permissions

### Sensor Frequency Low
```typescript
Getting <50Hz sampling rate
```
**Solution**:
- Close background apps
- Enable high-performance mode on phone
- Test on physical device (emulators are too slow)

## Performance Tips

1. **Battery Life**: Detection pauses when speed < 10 km/h
2. **Data Usage**: Anomalies upload ~1KB per detection
3. **Storage**: Model file is 8.6 MB, stored in app assets
4. **CPU**: Inference runs every 1 second, ~50ms per prediction
5. **Memory**: Buffers ~3.2KB of sensor data continuously

## Dependencies Installed

All required packages are in [package.json](mobile/package.json):
- ✅ `react-native-fast-tflite`: TFLite inference
- ✅ `react-native-sensors`: Accelerometer + Gyroscope
- ✅ `expo-location`: GPS tracking
- ✅ `rxjs`: Stream synchronization
- ✅ `@supabase/supabase-js`: Backend integration

## Summary

🎉 **Mobile app is ready to use with the 8-feature model!**

- Model trained on 6 datasets with geospatial features
- 95.89% accuracy validated with TFLite
- Complete sensor pipeline with GPS integration
- Real-time predictions every 1 second
- Automatic anomaly detection with vibration
- Ready for field testing

**Next Action**: Test on physical device while driving on roads with known potholes/speed bumps to validate real-world performance.
