"""
Test the TFLite model to ensure it works correctly for mobile deployment
Compares TFLite predictions with original Keras model predictions
"""

import numpy as np
import tensorflow as tf
from sklearn.model_selection import train_test_split
from preprocessing import load_and_preprocess_data, create_synthetic_data

# Config
RAW_DATA_DIR = "../../raw_data"
KERAS_MODEL_PATH = "../../models/final/road_sense_model.h5"
TFLITE_MODEL_PATH = "../../models/final/road_sense_model.tflite"

# Label names
LABELS = {
    0: 'Smooth',
    1: 'Pothole',
    2: 'Speed Bump'
}

def test_tflite_model():
    """Test TFLite model and compare with Keras model"""
    
    print("="*60)
    print("TFLite Model Testing")
    print("="*60)
    
    # 1. Load test data
    print("\n[1/5] Loading test data...")
    X, y = load_and_preprocess_data(RAW_DATA_DIR)
    
    if len(X) == 0:
        print("No data found. Generating synthetic data.")
        X, y = create_synthetic_data(num_samples=100)
    
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    
    # Use first 10 samples for quick test
    X_test_sample = X_test[:10].astype(np.float32)
    y_test_sample = y_test[:10]
    
    print(f"  Test samples: {len(X_test_sample)}")
    print(f"  Input shape: {X_test_sample.shape}")
    
    # 2. Load Keras model
    print(f"\n[2/5] Loading Keras model...")
    keras_model = tf.keras.models.load_model(KERAS_MODEL_PATH)
    print("  ✓ Keras model loaded")
    
    # 3. Load TFLite model
    print(f"\n[3/5] Loading TFLite model from {TFLITE_MODEL_PATH}...")
    interpreter = tf.lite.Interpreter(model_path=TFLITE_MODEL_PATH)
    interpreter.allocate_tensors()
    
    # Get input and output details
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    
    print("  ✓ TFLite model loaded")
    print(f"  Input details: shape={input_details[0]['shape']}, dtype={input_details[0]['dtype']}")
    print(f"  Output details: shape={output_details[0]['shape']}, dtype={output_details[0]['dtype']}")
    
    # 4. Get predictions from both models
    print(f"\n[4/5] Running predictions...")
    
    # Keras predictions
    keras_preds = keras_model.predict(X_test_sample, verbose=0)
    keras_labels = np.argmax(keras_preds, axis=1)
    
    # TFLite predictions
    tflite_preds = []
    for i in range(len(X_test_sample)):
        # Set input tensor
        interpreter.set_tensor(input_details[0]['index'], X_test_sample[i:i+1])
        
        # Run inference
        interpreter.invoke()
        
        # Get output tensor
        output = interpreter.get_tensor(output_details[0]['index'])
        tflite_preds.append(output[0])
    
    tflite_preds = np.array(tflite_preds)
    tflite_labels = np.argmax(tflite_preds, axis=1)
    
    print("  ✓ Predictions complete")
    
    # 5. Compare results
    print(f"\n[5/5] Comparing predictions...")
    print("\n" + "="*60)
    print("COMPARISON RESULTS")
    print("="*60)
    
    # Calculate differences
    pred_diff = np.abs(keras_preds - tflite_preds)
    max_diff = np.max(pred_diff)
    mean_diff = np.mean(pred_diff)
    
    print(f"\n📊 Prediction Differences:")
    print(f"  Max difference: {max_diff:.6f}")
    print(f"  Mean difference: {mean_diff:.6f}")
    
    # Check if predictions match
    predictions_match = np.array_equal(keras_labels, tflite_labels)
    accuracy_match = np.mean(keras_labels == tflite_labels) * 100
    
    print(f"\n🎯 Label Agreement:")
    print(f"  Predictions match: {predictions_match}")
    print(f"  Agreement rate: {accuracy_match:.2f}%")
    
    # Detailed comparison
    print(f"\n📋 Detailed Comparison (Sample by Sample):")
    print("-" * 90)
    print(f"{'#':<4} {'True':<12} {'Keras Pred':<12} {'TFLite Pred':<12} {'Match':<8} {'Max Diff':<12}")
    print("-" * 90)
    
    for i in range(len(X_test_sample)):
        true_label = LABELS[y_test_sample[i]]
        keras_pred = LABELS[keras_labels[i]]
        tflite_pred = LABELS[tflite_labels[i]]
        match = "✓" if keras_labels[i] == tflite_labels[i] else "✗"
        diff = np.max(np.abs(keras_preds[i] - tflite_preds[i]))
        
        print(f"{i:<4} {true_label:<12} {keras_pred:<12} {tflite_pred:<12} {match:<8} {diff:.6f}")
    
    # Confidence comparison
    print(f"\n📈 Confidence Comparison (first 3 samples):")
    print("-" * 60)
    for i in range(min(3, len(X_test_sample))):
        print(f"\nSample {i}: True label = {LABELS[y_test_sample[i]]}")
        print(f"  Keras:  Smooth={keras_preds[i][0]:.4f}, Pothole={keras_preds[i][1]:.4f}, Bump={keras_preds[i][2]:.4f}")
        print(f"  TFLite: Smooth={tflite_preds[i][0]:.4f}, Pothole={tflite_preds[i][1]:.4f}, Bump={tflite_preds[i][2]:.4f}")
    
    # Final verdict
    print("\n" + "="*60)
    if predictions_match and max_diff < 0.01:
        print("✓ TFLite model is working correctly!")
        print("  The model is ready for mobile deployment.")
    elif accuracy_match >= 95:
        print("⚠️  TFLite model has minor differences but is acceptable")
        print(f"  Agreement rate: {accuracy_match:.2f}%")
    else:
        print("✗ TFLite model has significant differences")
        print("  Please review the model conversion process.")
    print("="*60)

if __name__ == "__main__":
    test_tflite_model()
