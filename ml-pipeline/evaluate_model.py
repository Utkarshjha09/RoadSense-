"""
Evaluate model accuracy on test dataset
Calculates precision, recall, F1-score, and confusion matrix
"""

import tensorflow as tf
import numpy as np
import pandas as pd
from sklearn.metrics import classification_report, confusion_matrix
import os
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
MODEL_CANDIDATES = [
    SCRIPT_DIR / "../models/final/road_sense_model.tflite",  # repo-root models/
    SCRIPT_DIR / "models/final/road_sense_model.tflite",     # ml-pipeline/models/
]


def resolve_model_path():
    """Return first existing model path from known locations, else None."""
    for candidate in MODEL_CANDIDATES:
        resolved = candidate.resolve()
        if resolved.exists():
            return resolved
    return None

def load_test_data():
    """Load test data from raw_data or generate synthetic data"""
    
    # Try to load real data
    test_file = SCRIPT_DIR / "../raw_data/test_data.csv"
    
    if test_file.exists():
        print(f"📂 Loading test data from {test_file}")
        df = pd.read_csv(test_file)
        
        # Expected columns: ax, ay, az, gx, gy, gz, label
        X = df[['ax', 'ay', 'az', 'gx', 'gy', 'gz']].values
        y = df['label'].values  # 0=Smooth, 1=Pothole, 2=SpeedBump
        
        return X, y
    else:
        print("⚠️  No test data found. Generating synthetic data...")
        return generate_synthetic_test_data()


def generate_synthetic_test_data(n_samples=300):
    """Generate synthetic test data for demonstration"""
    
    samples_per_class = n_samples // 3
    time_steps = 100
    X_list = []
    y_list = []
    
    # Class 0: Smooth (low variance)
    for _ in range(samples_per_class):
        sample = np.random.randn(time_steps, 6) * 0.3
        X_list.append(sample)
        y_list.append(0)
    
    # Class 1: Pothole (sharp spike)
    for _ in range(samples_per_class):
        sample = np.random.randn(time_steps, 6) * 0.5
        spike_pos = np.random.randint(int(time_steps * 0.3), int(time_steps * 0.7))
        sample[spike_pos:spike_pos+10, 2] += np.random.uniform(3, 6)  # Vertical spike
        X_list.append(sample)
        y_list.append(1)
    
    # Class 2: Speed Bump (sustained elevation)
    for _ in range(samples_per_class):
        sample = np.random.randn(time_steps, 6) * 0.5
        bump_start = np.random.randint(int(time_steps * 0.25), int(time_steps * 0.5))
        bump_end = bump_start + np.random.randint(int(time_steps * 0.15), int(time_steps * 0.35))
        sample[bump_start:bump_end, 2] += np.random.uniform(1.5, 3.0)
        X_list.append(sample)
        y_list.append(2)
    
    X = np.array(X_list)
    y = np.array(y_list)
    
    # Shuffle
    indices = np.random.permutation(len(X))
    X = X[indices]
    y = y[indices]
    
    print(f"✅ Generated {n_samples} synthetic samples")
    return X, y


def evaluate_model():
    """Evaluate the TFLite model"""
    
    model_path = resolve_model_path()
    
    if model_path is None:
        print("❌ Model not found in expected locations:")
        for candidate in MODEL_CANDIDATES:
            print(f"   - {candidate.resolve()}")
        print("Run 'python src/train.py' from the ml-pipeline directory first.")
        return
    
    print("=" * 70)
    print("📊 RoadSense Model Evaluation")
    print("=" * 70)
    
    # Load model
    print("\n📥 Loading model...")
    interpreter = tf.lite.Interpreter(model_path=str(model_path))
    interpreter.allocate_tensors()
    
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    print("✅ Model loaded")
    
    # Load test data
    print("\n📂 Loading test data...")
    X_test, y_test = load_test_data()
    print(f"✅ Loaded {len(X_test)} test samples")
    print(f"   Class distribution: {np.bincount(y_test)}")
    
    # Run predictions
    print("\n🔄 Running predictions...")
    y_pred = []
    
    for i, sample in enumerate(X_test):
        if (i + 1) % 50 == 0:
            print(f"   Processed {i + 1}/{len(X_test)} samples...")
        
        # Reshape dynamically to (1, time_steps, features)
        input_data = sample.astype(np.float32)[np.newaxis, ...]
        
        # Run inference
        interpreter.set_tensor(input_details[0]['index'], input_data)
        interpreter.invoke()
        output = interpreter.get_tensor(output_details[0]['index'])[0]
        
        # Get predicted class
        pred_class = np.argmax(output)
        y_pred.append(pred_class)
    
    y_pred = np.array(y_pred)
    
    # Calculate metrics
    print("\n" + "=" * 70)
    print("📈 Evaluation Results")
    print("=" * 70)
    
    # Overall accuracy
    accuracy = np.mean(y_pred == y_test) * 100
    print(f"\n✅ Overall Accuracy: {accuracy:.2f}%")
    
    # Per-class metrics
    class_names = ['Smooth', 'Pothole', 'SpeedBump']
    print("\n📊 Classification Report:")
    print("-" * 70)
    report = classification_report(y_test, y_pred, target_names=class_names, digits=3)
    print(report)
    
    # Confusion matrix
    print("\n📊 Confusion Matrix:")
    print("-" * 70)
    cm = confusion_matrix(y_test, y_pred)
    
    # Pretty print confusion matrix
    print(f"\n{'':12s} {'Predicted'}")
    print(f"{'Actual':12s} {'Smooth':>10s} {'Pothole':>10s} {'SpeedBump':>10s}")
    print("-" * 50)
    for i, class_name in enumerate(class_names):
        row = f"{class_name:12s}"
        for j in range(3):
            row += f"{cm[i, j]:10d}"
        print(row)
    
    # Per-class accuracy
    print("\n📊 Per-Class Accuracy:")
    print("-" * 70)
    for i, class_name in enumerate(class_names):
        class_mask = y_test == i
        class_acc = np.mean(y_pred[class_mask] == y_test[class_mask]) * 100
        print(f"   {class_name:12s}: {class_acc:6.2f}%")
    
    # Misclassifications
    misclassified = np.sum(y_pred != y_test)
    print(f"\n❌ Misclassified: {misclassified}/{len(y_test)} ({misclassified/len(y_test)*100:.1f}%)")
    
    print("\n" + "=" * 70)
    print("✅ Evaluation Complete!")
    print("=" * 70)
    
    # Recommendations
    print("\n💡 Recommendations:")
    if accuracy > 90:
        print("   ✅ Excellent accuracy! Model is ready for deployment.")
    elif accuracy > 75:
        print("   ⚠️  Good accuracy, but could be improved with more training data.")
    else:
        print("   ❌ Low accuracy. Consider:")
        print("      - Collecting more diverse training data")
        print("      - Adjusting model hyperparameters")
        print("      - Increasing training epochs")
        print("      - Checking data quality and labeling")


if __name__ == '__main__':
    evaluate_model()
