"""
Evaluate the trained RoadSense model
Shows detailed metrics: accuracy, precision, recall, F1-score, and confusion matrix
"""

import numpy as np
import tensorflow as tf
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
import matplotlib.pyplot as plt
import seaborn as sns
from preprocessing import load_and_preprocess_data, create_synthetic_data

# Config
RAW_DATA_DIR = "../../raw_data"
MODEL_PATH = "../../models/final/road_sense_model.h5"

# Label names
LABELS = {
    0: 'Smooth',
    1: 'Pothole',
    2: 'Speed Bump'
}

def plot_confusion_matrix(cm, labels):
    """Plot confusion matrix"""
    plt.figure(figsize=(10, 8))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
                xticklabels=labels.values(), 
                yticklabels=labels.values())
    plt.title('Confusion Matrix')
    plt.ylabel('True Label')
    plt.xlabel('Predicted Label')
    plt.tight_layout()
    plt.savefig('../../models/final/confusion_matrix.png', dpi=300, bbox_inches='tight')
    print("\n✓ Confusion matrix saved to: ../../models/final/confusion_matrix.png")
    plt.close()

def evaluate_model():
    """Load model and evaluate on test data"""
    
    print("="*60)
    print("RoadSense Model Evaluation")
    print("="*60)
    
    # 1. Load Data
    print("\n[1/4] Loading data...")
    X, y = load_and_preprocess_data(RAW_DATA_DIR)
    
    if len(X) == 0:
        print("No data found. Generating synthetic data for demonstration.")
        X, y = create_synthetic_data(num_samples=500)
    
    print(f"  Total samples: {len(X)}")
    print(f"  Feature shape: {X.shape}")
    
    # 2. Split data (using same split as training)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    print(f"  Test samples: {len(X_test)}")
    
    # 3. Load Model
    print(f"\n[2/4] Loading model from {MODEL_PATH}...")
    try:
        model = tf.keras.models.load_model(MODEL_PATH)
        print("  ✓ Model loaded successfully")
        print(f"  Model input shape: {model.input_shape}")
        print(f"  Model output shape: {model.output_shape}")
    except Exception as e:
        print(f"  ✗ Error loading model: {e}")
        return
    
    # 4. Make Predictions
    print("\n[3/4] Making predictions on test set...")
    y_pred_probs = model.predict(X_test, verbose=0)
    y_pred = np.argmax(y_pred_probs, axis=1)
    
    # 5. Calculate Metrics
    print("\n[4/4] Calculating metrics...")
    accuracy = accuracy_score(y_test, y_pred)
    
    print("\n" + "="*60)
    print("EVALUATION RESULTS")
    print("="*60)
    
    # Overall Accuracy
    print(f"\n📊 Overall Accuracy: {accuracy*100:.2f}%")
    
    # Class Distribution
    print(f"\n📈 Test Set Distribution:")
    unique, counts = np.unique(y_test, return_counts=True)
    for label, count in zip(unique, counts):
        print(f"  {LABELS[label]:12s}: {count:4d} samples ({count/len(y_test)*100:.1f}%)")
    
    # Classification Report
    print(f"\n📋 Detailed Classification Report:")
    print("-" * 60)
    report = classification_report(
        y_test, y_pred, 
        target_names=list(LABELS.values()),
        digits=4
    )
    print(report)
    
    # Confusion Matrix
    print("🔍 Confusion Matrix:")
    print("-" * 60)
    cm = confusion_matrix(y_test, y_pred)
    
    # Print confusion matrix with labels
    print("\n" + " " * 15 + "Predicted")
    print(" " * 10 + "".join([f"{LABELS[i]:12s}" for i in range(len(LABELS))]))
    print("-" * 60)
    for i, row in enumerate(cm):
        print(f"Actual {LABELS[i]:8s} | " + "".join([f"{val:12d}" for val in row]))
    
    # Per-class accuracy
    print("\n📊 Per-Class Accuracy:")
    print("-" * 60)
    for i in range(len(LABELS)):
        if cm[i].sum() > 0:
            class_acc = cm[i][i] / cm[i].sum() * 100
            print(f"  {LABELS[i]:12s}: {class_acc:.2f}%")
    
    # Save confusion matrix plot
    try:
        plot_confusion_matrix(cm, LABELS)
    except Exception as e:
        print(f"\n⚠️  Could not save confusion matrix plot: {e}")
    
    # Sample Predictions
    print("\n🔬 Sample Predictions (first 10):")
    print("-" * 60)
    print(f"{'Index':<8} {'True Label':<15} {'Predicted':<15} {'Confidence':<12} {'Correct':<8}")
    print("-" * 60)
    for i in range(min(10, len(y_test))):
        true_label = LABELS[y_test[i]]
        pred_label = LABELS[y_pred[i]]
        confidence = y_pred_probs[i][y_pred[i]] * 100
        correct = "✓" if y_test[i] == y_pred[i] else "✗"
        print(f"{i:<8} {true_label:<15} {pred_label:<15} {confidence:>6.2f}%     {correct:<8}")
    
    print("\n" + "="*60)
    print("Evaluation Complete!")
    print("="*60)

if __name__ == "__main__":
    evaluate_model()
