# ESP32 Sensor Integration

RoadSense can now read IMU data from either:

- the phone sensors
- an ESP32 streaming sensor values over WebSocket

## App flow

Open the Driving screen and choose `ESP32` as the sensor source. Enter the ESP32 WebSocket URL, then start detection.

Default example:

```text
ws://192.168.4.1:81
```

The phone still provides GPS coordinates. The ESP32 provides IMU readings.

## Required payload

The app expects JSON messages with these fields:

```json
{
  "ax": 0.12,
  "ay": -0.03,
  "az": 9.81,
  "gx": 0.01,
  "gy": 0.02,
  "gz": -0.01,
  "timestamp": 1710000000000
}
```

Optional fields:

```json
{
  "latitude": 28.6139,
  "longitude": 77.2090
}
```

## Important constraint

The current ML model expects 6 motion features:

- accelerometer: `ax`, `ay`, `az`
- gyroscope: `gx`, `gy`, `gz`

If your hardware only sends gyroscope values, the model input will be incomplete and prediction quality will degrade. Use an IMU that exposes both accelerometer and gyroscope data, such as MPU6050, MPU6500, or MPU9250.

## ESP32 example

Example Arduino-style payload loop:

```cpp
String payload = "{\"ax\":" + String(ax, 4) +
                 ",\"ay\":" + String(ay, 4) +
                 ",\"az\":" + String(az, 4) +
                 ",\"gx\":" + String(gx, 4) +
                 ",\"gy\":" + String(gy, 4) +
                 ",\"gz\":" + String(gz, 4) +
                 ",\"timestamp\":" + String(millis()) +
                 "}";
webSocket.broadcastTXT(payload);
```

## Recommended device behavior

- Sample IMU data close to `50 Hz`
- Send one JSON message per sample
- Keep the phone and ESP32 on the same Wi-Fi network, or let the ESP32 expose its own access point
- Calibrate the IMU before streaming
