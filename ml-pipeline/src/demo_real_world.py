"""
Real-World Pothole Detection Demo
Demonstrates how the model works with GPS coordinates and sensor readings
"""

import numpy as np
import tensorflow as tf

# Load the TFLite model
MODEL_PATH = "../../models/final/road_sense_model.tflite"

LABELS = {
    0: 'Smooth Road',
    1: 'Pothole',
    2: 'Speed Bump'
}

def predict_road_condition(sensor_window, latitude, longitude):
    """
    Predict road condition from sensor readings and GPS location
    
    Args:
        sensor_window: numpy array of shape (100, 6) containing 2 seconds of:
                      - accelerometer readings (ax, ay, az)
                      - gyroscope readings (gx, gy, gz)
        latitude: float - GPS latitude coordinate
        longitude: float - GPS longitude coordinate
    
    Returns:
        prediction: dict with 'class', 'confidence', 'probabilities'
    """
    
    # Load TFLite model
    interpreter = tf.lite.Interpreter(model_path=MODEL_PATH)
    interpreter.allocate_tensors()
    
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    
    # Create full input with lat/lon (shape: 100, 8)
    lat_lon_column = np.full((100, 2), [latitude, longitude], dtype=np.float32)
    full_input = np.concatenate([sensor_window, lat_lon_column], axis=1)
    
    # Add batch dimension (1, 100, 8)
    full_input = full_input[np.newaxis, :, :].astype(np.float32)
    
    # Run inference
    interpreter.set_tensor(input_details[0]['index'], full_input)
    interpreter.invoke()
    output = interpreter.get_tensor(output_details[0]['index'])
    
    # Get prediction
    probabilities = output[0]
    predicted_class = np.argmax(probabilities)
    confidence = probabilities[predicted_class]
    
    return {
        'class': LABELS[predicted_class],
        'class_id': int(predicted_class),
        'confidence': float(confidence * 100),
        'probabilities': {
            'smooth': float(probabilities[0] * 100),
            'pothole': float(probabilities[1] * 100),
            'speed_bump': float(probabilities[2] * 100)
        }
    }

def simulate_driving_scenario():
    """
    Simulate a real-world driving scenario with multiple road conditions
    """
    print("="*70)
    print("RoadSense: Real-World Driving Simulation")
    print("="*70)
    print("\nScenario: Vehicle driving through city with varying road conditions")
    print("- Sampling rate: 50Hz (50 readings per second)")
    print("- Window size: 100 samples (2 seconds of driving)")
    print("- Features: Accelerometer + Gyroscope + GPS\n")
    
    # Scenario 1: Smooth road
    print("\n" + "─"*70)
    print("📍 Location 1: Smooth city road")
    print("   GPS: (40.4474, -79.9442) - Pittsburgh, PA")
    print("   Sensor readings: Low acceleration, minimal gyro variation")
    print("─"*70)
    
    # Simulate smooth road sensor data (100 samples)
    smooth_sensors = np.random.randn(100, 6) * 0.05  # Low variation
    smooth_sensors[:, 2] += 9.81  # Add gravity to Z-axis
    
    result = predict_road_condition(
        sensor_window=smooth_sensors.astype(np.float32),
        latitude=40.4474,
        longitude=-79.9442
    )
    
    print(f"\n🔍 Prediction: {result['class']}")
    print(f"   Confidence: {result['confidence']:.2f}%")
    print(f"   Probabilities:")
    print(f"      - Smooth Road: {result['probabilities']['smooth']:.2f}%")
    print(f"      - Pothole:     {result['probabilities']['pothole']:.2f}%")
    print(f"      - Speed Bump:  {result['probabilities']['speed_bump']:.2f}%")
    
    # Scenario 2: Pothole detected
    print("\n" + "─"*70)
    print("📍 Location 2: Road with pothole")
    print("   GPS: (40.4630, -79.9309) - Pittsburgh, PA")
    print("   Sensor readings: Sudden spike in acceleration and gyroscope")
    print("─"*70)
    
    # Simulate pothole sensor data with a spike
    pothole_sensors = np.random.randn(100, 6) * 0.05
    pothole_sensors[:, 2] += 9.81
    # Add pothole impact at sample 50 (sudden jolt)
    pothole_sensors[45:55, 0:3] += np.random.randn(10, 3) * 2.0  # Accel spike
    pothole_sensors[45:55, 3:6] += np.random.randn(10, 3) * 1.5  # Gyro spike
    
    result = predict_road_condition(
        sensor_window=pothole_sensors.astype(np.float32),
        latitude=40.4630,
        longitude=-79.9309
    )
    
    print(f"\n🔍 Prediction: {result['class']}")
    print(f"   Confidence: {result['confidence']:.2f}%")
    print(f"   Probabilities:")
    print(f"      - Smooth Road: {result['probabilities']['smooth']:.2f}%")
    print(f"      - Pothole:     {result['probabilities']['pothole']:.2f}%")
    print(f"      - Speed Bump:  {result['probabilities']['speed_bump']:.2f}%")
    
    # Scenario 3: Speed bump
    print("\n" + "─"*70)
    print("📍 Location 3: Speed bump zone")
    print("   GPS: (23.0811, 76.8429) - India")
    print("   Sensor readings: Gradual rise and fall in acceleration")
    print("─"*70)
    
    # Simulate speed bump - gradual rise and fall
    bump_sensors = np.random.randn(100, 6) * 0.05
    bump_sensors[:, 2] += 9.81
    # Add speed bump pattern (gradual rise, peak, gradual fall)
    t = np.linspace(0, 1, 100)
    bump_pattern = np.sin(t * np.pi) * 3.0  # Bell curve
    bump_sensors[:, 2] += bump_pattern  # Add to Z acceleration
    bump_sensors[:, 4] += bump_pattern * 0.5  # Add to gyro Y
    
    result = predict_road_condition(
        sensor_window=bump_sensors.astype(np.float32),
        latitude=23.0811,
        longitude=76.8429
    )
    
    print(f"\n🔍 Prediction: {result['class']}")
    print(f"   Confidence: {result['confidence']:.2f}%")
    print(f"   Probabilities:")
    print(f"      - Smooth Road: {result['probabilities']['smooth']:.2f}%")
    print(f"      - Pothole:     {result['probabilities']['pothole']:.2f}%")
    print(f"      - Speed Bump:  {result['probabilities']['speed_bump']:.2f}%")
    
    print("\n" + "="*70)
    print("✓ Simulation Complete!")
    print("="*70)
    
    # How to use in real application
    print("\n💡 HOW TO USE IN YOUR APPLICATION:")
    print("-"*70)
    print("""
1. COLLECT SENSOR DATA:
   - Continuously read accelerometer + gyroscope at 50Hz
   - Get GPS coordinates when available
   
2. CREATE SLIDING WINDOW:
   - Maintain a buffer of last 100 samples (2 seconds)
   - Update buffer as new sensor data arrives
   
3. MAKE PREDICTION:
   - Every 1 second (50 samples), run prediction on the window
   - Use current GPS coordinates with sensor window
   
4. REPORT RESULTS:
   - If "Pothole" detected with >80% confidence:
     → Save GPS location + timestamp
     → Alert user
   - If "Speed Bump" detected:
     → Log location for reference
   - Continue monitoring...

EXAMPLE CODE FOR MOBILE APP:
```python
# In your mobile app sensor handler:
sensor_buffer = []  # Holds last 100 samples

def on_sensor_update(ax, ay, az, gx, gy, gz):
    sensor_buffer.append([ax, ay, az, gx, gy, gz])
    
    if len(sensor_buffer) > 100:
        sensor_buffer.pop(0)  # Remove oldest
    
    # Predict every 50 samples (1 second)
    if len(sensor_buffer) == 100 and len(sensor_buffer) % 50 == 0:
        lat, lon = get_current_gps()
        result = predict_road_condition(
            np.array(sensor_buffer),
            lat, lon
        )
        
        if result['class'] == 'Pothole' and result['confidence'] > 80:
            report_pothole(lat, lon, result['confidence'])
```
""")

if __name__ == "__main__":
    simulate_driving_scenario()
