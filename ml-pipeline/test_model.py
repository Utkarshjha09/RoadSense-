"""
Test the RoadSense TFLite model.

Shows model architecture, input/output shapes, and runs sample predictions.
"""

import os
from pathlib import Path
import warnings

# Suppress verbose TensorFlow info logs (e.g., oneDNN banner).
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import numpy as np
import tensorflow as tf

warnings.filterwarnings("ignore", category=UserWarning, module="tensorflow.lite")

SCRIPT_DIR = Path(__file__).resolve().parent
MODEL_CANDIDATES = [
    SCRIPT_DIR / "../models/final/road_sense_model.tflite",  # repo-root models/
    SCRIPT_DIR / "models/final/road_sense_model.tflite",  # ml-pipeline/models/
]


def resolve_model_path():
    """Return first existing model path from known locations, else None."""
    for candidate in MODEL_CANDIDATES:
        resolved = candidate.resolve()
        if resolved.exists():
            return resolved
    return None


def test_model():
    """Test the TFLite model with sample data."""

    model_path = resolve_model_path()

    if model_path is None:
        print("Model not found in expected locations:")
        for candidate in MODEL_CANDIDATES:
            print(f"  - {candidate.resolve()}")
        print("Run 'python src/train.py' from the ml-pipeline directory first.")
        return

    print("=" * 60)
    print("RoadSense Model Test")
    print("=" * 60)

    print("\nLoading model...")
    try:
        interpreter = tf.lite.Interpreter(model_path=str(model_path))
        interpreter.allocate_tensors()
    except Exception as exc:
        print(f"Failed to initialize TFLite interpreter for: {model_path}")
        print(f"Reason: {exc}")
        print("")
        print("Likely causes:")
        print("  - Corrupt/invalid quantized model (NaN scale in INT8 tensors)")
        print("  - Model contains SELECT_TF_OPS that are not available in this runtime")
        print("")
        print("Recommended next step:")
        print("  1. Re-train and re-export the model: python src/train.py")
        print("  2. Re-run this test: python test_model.py")
        return

    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()

    print("Model loaded successfully.")
    print("\nModel Information:")
    print(f"   Input shape:  {input_details[0]['shape']}")
    print(f"   Input dtype:  {input_details[0]['dtype']}")
    print(f"   Output shape: {output_details[0]['shape']}")
    print(f"   Output dtype: {output_details[0]['dtype']}")

    expected_input = (1, 100, 6)
    expected_output = (1, 3)

    input_shape = tuple(input_details[0]["shape"])
    output_shape = tuple(output_details[0]["shape"])

    if input_shape != expected_input:
        print(f"\nWarning: Expected input shape {expected_input}, got {input_shape}")
    if output_shape != expected_output:
        print(f"Warning: Expected output shape {expected_output}, got {output_shape}")

    print("\n" + "=" * 60)
    print("Running Test Predictions")
    print("=" * 60)

    batch_size, time_steps, feature_count = map(int, input_details[0]["shape"])

    print("\n1. Test: Smooth Road (low variance)")
    smooth_data = np.random.randn(batch_size, time_steps, feature_count).astype(np.float32) * 0.1
    result = run_inference(interpreter, input_details, output_details, smooth_data)
    print_prediction(result)

    print("\n2. Test: Simulated Pothole (spike in vertical acceleration)")
    pothole_data = np.random.randn(batch_size, time_steps, feature_count).astype(np.float32) * 0.2
    start = max(0, int(time_steps * 0.45))
    end = min(time_steps, start + max(2, int(time_steps * 0.08)))
    pothole_data[0, start:end, 2] += 5.0
    result = run_inference(interpreter, input_details, output_details, pothole_data)
    print_prediction(result)

    print("\n3. Test: Simulated Speed Bump (sustained elevation)")
    speedbump_data = np.random.randn(batch_size, time_steps, feature_count).astype(np.float32) * 0.2
    bump_start = max(0, int(time_steps * 0.35))
    bump_end = min(time_steps, bump_start + max(4, int(time_steps * 0.3)))
    speedbump_data[0, bump_start:bump_end, 2] += 2.0
    result = run_inference(interpreter, input_details, output_details, speedbump_data)
    print_prediction(result)

    print("\n4. Test: Random Noise (high variance)")
    noise_data = np.random.randn(batch_size, time_steps, feature_count).astype(np.float32) * 2.0
    result = run_inference(interpreter, input_details, output_details, noise_data)
    print_prediction(result)

    print("\n" + "=" * 60)
    print("Testing Complete.")
    print("=" * 60)

    print("\nNotes:")
    print(f"   - Input: {time_steps} timesteps x {feature_count} features (ax, ay, az, gx, gy, gz)")
    print("   - Output: [smooth_prob, pothole_prob, speedbump_prob]")
    print("   - Detection threshold typically: 0.7 (70%)")
    print("   - Model runs on-device in mobile app at ~50Hz sensor rate")

    model_size = model_path.stat().st_size
    print(f"\nModel Size: {model_size:,} bytes ({model_size/1024:.1f} KB)")


def run_inference(interpreter, input_details, output_details, data):
    """Run inference on the model."""
    interpreter.set_tensor(input_details[0]["index"], data)
    interpreter.invoke()
    output = interpreter.get_tensor(output_details[0]["index"])
    return output[0]


def print_prediction(predictions):
    """Pretty print prediction results."""
    classes = ["Smooth", "Pothole", "SpeedBump"]

    print("   Results:")
    for cls, prob in zip(classes, predictions):
        bar_length = int(prob * 40)
        bar = "#" * bar_length + "-" * (40 - bar_length)
        print(f"   {cls:10s} [{bar}] {prob:6.2%}")

    max_idx = np.argmax(predictions)
    max_prob = predictions[max_idx]
    predicted_class = classes[max_idx]

    if max_prob > 0.7:
        print(f"   -> Prediction: {predicted_class.upper()} (confidence: {max_prob:.1%})")
    else:
        print(f"   -> Prediction: UNCERTAIN (highest: {predicted_class} at {max_prob:.1%})")


if __name__ == "__main__":
    test_model()
