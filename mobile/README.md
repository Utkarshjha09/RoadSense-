# RoadSense Mobile App

Expo/React Native (Android-first) app for real-time road-surface detection, route quality planning, training-data collection, and field operator workflows. It reads phone (or ESP32) motion sensors, runs an on-device TFLite model, and syncs detections to a Supabase backend so field teams and drivers can see and log potholes and speed bumps as they happen.

## What the app does

1. Sign in (email/password + OTP, or create an account with a role).
2. Land on the Home dashboard — real, live status (GPS, sensor source), today's stats, recent detections.
3. Start live driving detection (phone sensors or a paired ESP32 device) or plan a route on the map.
4. Log and label sensor samples for model training, export CSV, or queue anomaly CSVs for cloud upload.
5. Review analytics, manage settings (including ESP32 device connection), check notifications, and get help.

## Screens

| Screen | File | Purpose |
|---|---|---|
| Auth | `app/auth.tsx` | Sign in, create account (with role picker), 6-digit OTP verify, forgot/reset password. No bypass/demo login — every path goes through Supabase auth. |
| Home | `app/home.tsx` | Dashboard hub: live GPS/sensor status strip, map preview, quick actions, real weekly detection chart, recent detections, help entry point. |
| Driving | `app/driving.tsx` | Core field console: route input, live TFLite inference, phone/ESP32 sensor toggle, navigation overlay, anomaly markers. |
| Map | `app/map.tsx` / `app/map.web.tsx` | Route-quality planning: origin/destination, alternative routes overlaid with anomaly data, risk comparison. |
| Data Logger | `app/logger.tsx` | Capture and label sensor windows (pothole/speed bump/normal), 7-day detection timeline, dataset stats, CSV export, cloud upload queue. |
| Analytics | `app/analytics.tsx` | Period-filtered (7D/30D/3M) detection trends, KPI breakdown, top detection locations — all derived from real logged samples. |
| Settings | `app/settings.tsx` | Device Connection (see below), AI/detection toggles, data & sync, display & sound, sign out. |
| Notifications | `app/notifications.tsx` | Real feed built from logged detections plus a pending-cloud-upload banner. |
| Support | `app/support.tsx` | FAQ accordion + contact form + quick contact tiles. |
| Account | `app/account.tsx` | Profile details, role, password/OTP management. |

Navigation is a persistent bottom tab bar (`components/bottom-nav-bar.tsx`): Home, Driving, Data, Analytics, Profile (5 core tabs, plus Settings/Notifications/Support reachable from Home's header icons).

## Device Connection (ESP32)

Under **Settings → Device Connection** you can choose the sensor source:

- **Phone** — uses the phone's built-in accelerometer/gyroscope (default).
- **ESP32** — streams sensor data from a physical ESP32 over WebSocket. Enter the device's **IP address** and **port** (defaults to `192.168.4.1:81`, matching a typical ESP32 AP), see a live `ws://ip:port` preview, and hit **Test Connection** to verify reachability before driving.

This choice is persisted (`src/services/device-connection.service.ts`, AsyncStorage) and shared between the Settings screen and the Driving screen — whichever you set last is used everywhere. Real connection state (connecting/streaming/error) is reported back from the live WebSocket session in `driving.tsx` and surfaces on the Home status strip (labelled "ESP32" or "Phone", with a live Connected/Not connected sub-label). GPS status on Home is a real device check (`expo-location`'s service-enabled + permission state), not a hardcoded value.

See [ESP32_INTEGRATION.md](ESP32_INTEGRATION.md) for wiring/firmware-side notes.

## Tech stack

- Expo SDK 54, React Native 0.81, TypeScript, Expo Router (file-based routing)
- `react-native-fast-tflite` for on-device inference, `expo-sensors` / `expo-location` for motion & GPS
- `@react-native-async-storage/async-storage` for local persistence (settings, logged samples, device connection)
- Supabase JS client for auth, data, and storage
- Native WebSocket for ESP32 streaming

## Environment variables

Create `mobile/.env`:

```bash
# Auth, data, and log storage
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_SUPABASE_LOG_BUCKET=roadsense-logs

# Route planning (map + driving screens)
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-key

# Optional backend services
EXPO_PUBLIC_CLOUD_API_URL=https://your-api.example.com
EXPO_PUBLIC_API_BASE_URL=https://your-api.example.com
EXPO_PUBLIC_API_SECRET=your-secret
EXPO_PUBLIC_OTP_SERVICE_URL=https://your-otp.example.com
EXPO_PUBLIC_OTP_ALLOW_LOCAL=0
```

ESP32 connection details (IP/port) are **not** env vars — they're configured per-install in-app under Settings → Device Connection.

## Setup

```bash
npm install
cp .env.example .env   # fill in the values above

# Recommended: real device build, needed for sensors/permissions
npx expo run:android

# Or just the dev server (limited — no native sensor/TFLite access without a dev build)
npx expo start
```

See [BUILD_INSTRUCTIONS.md](BUILD_INSTRUCTIONS.md) for EAS cloud builds.

## Project structure

```text
mobile/
├── app/                     Screens (see table above), file-based routing via Expo Router
│   └── _layout.tsx          Root stack, navigation options
├── components/              Shared UI: bottom-nav-bar, grouped-bar-chart, ui-kit, themed views
├── src/
│   ├── services/            sensor, tflite, supabase, data-logger, device-connection, settings,
│   │                        otp, contact, cloud-api, mobile-auth
│   ├── hooks/                Sensor / app-state hooks
│   ├── utils/                 Route and anomaly helpers
│   └── theme.ts              Centralized colors/spacing/typography
├── plugins/                 Custom Expo config plugin (autolinking settings)
└── scripts/                  Build-time helper scripts (autolinking check)
```

## Android permissions

Fine/coarse location, vibration, and motion/sensor access (via the Expo sensor stack). Test on a **physical Android device** — emulators and Expo Go don't provide real sensor data.

## Testing and validation

```bash
npx expo run:android                                          # build & run
npm run lint                                                  # ESLint
node --stack-size=8000 ./node_modules/typescript/lib/tsc.js --noEmit -p .   # type check (plain `tsc` can stack-overflow on this project)
```

## Troubleshooting

**Sensors don't respond** — use a development build (not Expo Go), test on a physical device, confirm motion/location permissions.

**ESP32 won't connect** — confirm the phone and ESP32 are on the same network, double-check IP/port in Settings → Device Connection, use Test Connection to isolate reachability vs. streaming issues.

**Route analysis fails** — set `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`, confirm origin/destination are filled in.

**Authentication doesn't work** — verify the Supabase URL/anon key, and the OTP service URL if OTP is enabled.

**Cloud uploads stay queued** — check network access and that the Supabase bucket / cloud API is reachable.

## Notes

- The web build of the driving screen (`driving.web.tsx`) is preview-only; the full sensor experience requires the Android build.
- All charts/stats in the app (Home, Analytics, Data Logger, Notifications) are derived from real locally-logged data — nothing is hardcoded/demo data.

## License

MIT
