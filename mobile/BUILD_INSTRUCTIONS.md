# Build Instructions for RoadSense Mobile

## Issue: "Cannot find module" Error

The error occurs because `react-native-fast-tflite` is a **native module** that requires a custom native build. It cannot run in Expo Go.

## Solution: Build a Development Build

### Option 1: Build Locally (Fastest for Development)

1. **Install EAS CLI** (if not already installed):
   ```bash
   npm install -g eas-cli
   ```

2. **Login to Expo**:
   ```bash
   eas login
   ```

3. **Build for Android** (development APK):
   ```bash
   cd mobile
   eas build --profile development --platform android --local
   ```
   
   This creates a development APK you can install on your Android device.

4. **Install the APK** on your Android device and run:
   ```bash
   npx expo start --dev-client
   ```

### Option 2: Build on EAS (Cloud Build)

If you don't have Android SDK installed locally:

```bash
cd mobile
eas build --profile development --platform android
```

This builds in the cloud. Once complete, download and install the APK from the Expo dashboard.

### Option 3: Quick Test with Expo Go (Limited)

**Note**: TFLite model loading will NOT work in Expo Go, but you can test other UI components.

```bash
npx expo start
```

Then scan the QR code with Expo Go app.

## After Building

1. Install the development build APK on your Android device
2. Make sure your device and computer are on the same network
3. Run: `npx expo start --dev-client`
4. The app will connect and the model should load successfully

## Troubleshooting

### "Module not found" after building
- Clear cache: `npx expo start --clear`
- Rebuild: `eas build --profile development --platform android --clear-cache`

### Model still not loading
- Check console logs in Metro bundler
- Verify model file exists: `mobile/assets/models/road_sense_model.tflite`
- Ensure file size is ~1.1 MB (not corrupted)

## Development Workflow

After initial build:
1. Code changes in JS/TS → hot reload automatically (no rebuild needed)
2. Native code changes → requires rebuild
3. New native dependencies → requires rebuild

## Production Build

When ready for production:
```bash
eas build --profile production --platform android
```

This creates an AAB file for Google Play Store.
