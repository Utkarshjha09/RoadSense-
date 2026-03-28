import numpy as np
import tensorflow as tf
import os
from sklearn.model_selection import train_test_split
from preprocessing import load_and_preprocess_data, create_synthetic_data
from model import build_tcn_bilstm_model

# Config
RAW_DATA_DIR = "../../raw_data"
MODEL_SAVE_PATH = "../../models/final/road_sense_model.h5"
TFLITE_SAVE_PATH = "../../models/final/road_sense_model.tflite"

def train():
    # 1. Load Data
    print("Loading data...")
    X, y = load_and_preprocess_data(RAW_DATA_DIR)
    
    if len(X) == 0:
        print("No data found in raw_data. Generating SYNTHETIC data for demonstration.")
        X, y = create_synthetic_data(num_samples=500)

    if not np.isfinite(X).all():
        raise ValueError("Training data contains NaN/Inf after preprocessing.")
    if not np.isfinite(y).all():
        raise ValueError("Labels contain NaN/Inf after preprocessing.")
    
    # 2. Split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    print(f"Training on {len(X_train)} samples, Testing on {len(X_test)} samples.")
    
    # 3. Build Model
    input_shape = (X_train.shape[1], X_train.shape[2])
    model = build_tcn_bilstm_model(input_shape=input_shape, num_classes=3)
    
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
        tf.keras.callbacks.ModelCheckpoint(MODEL_SAVE_PATH, save_best_only=True, monitor='val_loss'),
        tf.keras.callbacks.TerminateOnNaN(),
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
    
    # Convert with builtins only for wider runtime compatibility.
    converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS]
    
    # Optimization/Quantization (Optional but recommended for mobile)
    # Keep float conversion for stability/debuggability.
    # Quantization can be reintroduced later with a representative dataset.
    
    tflite_model = converter.convert()
    
    with open(TFLITE_SAVE_PATH, 'wb') as f:
        f.write(tflite_model)
    print(f"TFLite model saved to {TFLITE_SAVE_PATH}")

if __name__ == "__main__":
    train()
