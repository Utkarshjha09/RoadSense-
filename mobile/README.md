# RoadSense Mobile App

React Native (Expo) mobile application for real-time pothole detection using smartphone sensors.

## Features

- ✅ **Authentication** - Supabase email/password auth
- ✅ **Sensor Collection** - 50Hz accelerometer + gyroscope
- ✅ **Gravity Filtering** - Low-pass filter to isolate user acceleration
- ✅ **Real-time Detection** - GPS speed monitoring with auto-pause
- ✅ **Data Logging** - CSV export for training data collection
- ✅ **Backend Integration** - Automatic upload to Supabase
- 🚧 **TFLite Inference** - Coming soon (requires model without LSTM)

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env and add your Supabase credentials
```

### 3. Run App
```bash
# Development build (recommended)
npx expo run:android
# or
npx expo run:ios

# Expo Go (limited sensor access)
npx expo start
```

## Project Structure

```
mobile/
├── app/
│   ├── index.tsx           # Entry point with auth check
│   ├── auth.tsx            # Sign in/up screen
│   ├── home.tsx            # Main menu
│   ├── driving.tsx         # Real-time detection
│   └── logger.tsx          # Data collection
├── src/
│   ├── hooks/
│   │   └── useRoadSensors.ts    # Sensor hook (50Hz, gravity filter)
│   └── services/
│       └── supabase.service.ts  # Backend API client
└── assets/
    └── models/
        └── road_sense_model.tflite  # AI model (to be added)
```

## Screens

### 1. Authentication (`/auth`)
- Email/password sign in
- New user registration
- Auto-redirect to home on success

### 2. Home (`/home`)
- Main navigation menu
- Quick access to driving mode and data logger
- User profile with sign out

### 3. Driving Mode (`/driving`)
- Real-time pothole detection
- GPS speed monitoring
- Auto-pause when speed < 10 km/h
- Vibration feedback on detection
- Automatic upload to backend

### 4. Data Logger (`/logger`)
- Manual data collection for training
- Label buttons (Pothole, Speed Bump, Normal)
- CSV export to device storage

## Sensor Configuration

- **Frequency:** 50 Hz (20ms interval)
- **Window Size:** 100 samples (2 seconds)
- **Overlap:** 50% (50 samples)
- **Gravity Filter:** Low-pass (alpha=0.8)

## Environment Variables

Required in `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Permissions

### iOS
- Location (when in use)
- Motion sensors

### Android
- ACCESS_FINE_LOCATION
- ACCESS_COARSE_LOCATION
- VIBRATE

## Development Notes

### TFLite Integration (Pending)
Current model uses LSTM layers which require Flex Delegate. Options:
1. Retrain model without LSTM (TCN-only)
2. Use TensorFlow.js (slower)
3. Custom TFLite bridge with Flex support

### Testing
```bash
# Run on physical device (required for sensors)
npx expo run:android --device

# Check sensor availability
import { Accelerometer } from 'expo-sensors'
Accelerometer.isAvailableAsync()
```

## Troubleshooting

### Sensors not working
- Must use development build (`expo run:android/ios`)
- Expo Go has limited sensor access
- Test on physical device (simulators have no sensors)

### Location permission denied
- Check `app.json` has correct permissions
- Manually enable in device settings

### Supabase connection failed
- Verify `.env` credentials
- Check network connection
- Ensure database setup script was run

## Next Steps

1. ✅ Setup authentication
2. ✅ Implement sensor collection
3. ✅ Create driving screen
4. 🚧 Integrate TFLite model
5. 🚧 Add map view
6. 🚧 Implement offline queue

## License

MIT
