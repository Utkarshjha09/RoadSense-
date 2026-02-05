import numpy as np
import tensorflow as tf
import os
from sklearn.model_selection import train_test_split
from preprocessing import load_and_preprocess_data, create_synthetic_data
from model import build_tcn_bilstm_model

# Config
RAW_DATA_DIR = "../raw_data"
MODEL_SAVE_PATH = "../models/final/road_sense_model.h5"
TFLITE_SAVE_PATH = "../models/final/road_sense_model.tflite"

def train():
    # 1. Load Data
    print("Loading data...")
    X, y = load_and_preprocess_data(RAW_DATA_DIR)
    
    if len(X) == 0:
        print("No data found in raw_data. Generating SYNTHETIC data for demonstration.")
        X, y = create_synthetic_data(num_samples=500)
    
    # 2. Split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    print(f"Training on {len(X_train)} samples, Testing on {len(X_test)} samples.")
    
    # 3. Build Model
    # Input shape updated to 100 (2 seconds at 50Hz)
    model = build_tcn_bilstm_model(input_shape=(100, 6), num_classes=3)
    
    # 4. Train
    print("Starting training...")
    
    # Calculate Class Weights
    from sklearn.utils import class_weight
    classes = np.unique(y_train)
    weights = class_weight.compute_class_weight(class_weight='balanced', classes=classes, y=y_train)
    class_weights = dict(zip(classes, weights))
    print(f"Class Weights: {class_weights}")

    # Callbacks
    callbacks = [
        tf.keras.callbacks.EarlyStopping(monitor='val_loss', patience=5, restore_best_weights=True),
        tf.keras.callbacks.ModelCheckpoint(MODEL_SAVE_PATH, save_best_only=True, monitor='val_loss')
    ]

    history = model.fit(
        X_train, y_train,
        epochs=50, 
        batch_size=32,
        validation_data=(X_test, y_test),
        class_weight=class_weights,
        callbacks=callbacks
    )
    
    # 6. Convert to TFLite
    print("Converting to TFLite...")
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    
    # Enable SELECT_TF_OPS to support LSTM layers
    converter.target_spec.supported_ops = [
        tf.lite.OpsSet.TFLITE_BUILTINS,  # Enable TensorFlow Lite ops
        tf.lite.OpsSet.SELECT_TF_OPS     # Enable TensorFlow ops (needed for LSTM)
    ]
    converter._experimental_lower_tensor_list_ops = False
    
    # Optimization/Quantization (Optional but recommended for mobile)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    
    tflite_model = converter.convert()
    
    with open(TFLITE_SAVE_PATH, 'wb') as f:
        f.write(tflite_model)
    print(f"TFLite model saved to {TFLITE_SAVE_PATH}")

if __name__ == "__main__":
    train()
