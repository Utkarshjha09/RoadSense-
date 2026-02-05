# Phase 1: Machine Learning Pipeline for RoadSense
**Role:** You are the Lead AI/ML Engineer for the "RoadSense" project.
**Goal:** Create a complete, end-to-end Python pipeline (preferably a Google Colab Notebook) to train a **Hybrid TCN-BiLSTM** model for detecting road anomalies using smartphone sensor data.

## 1. Context & Data Sources
We are building a classifier to distinguish between three classes: **`Normal`**, **`Pothole`**, and **`SpeedBump`**.
Since we haven't collected our own data yet, we will use two public proxy datasets:
1.  **Kaggle Pothole Dataset:** (Assume the user will upload a CSV containing `Time`, `AccX`, `AccY`, `AccZ`, `GyroX`, `GyroY`, `GyroZ`, `Label`).
2.  **Accelerometer.xyz Dataset:** (Assume similar IMU data format).

## 2. Required Steps & Technical Logic

### Step A: Data Ingestion & Standardization
* Write a function to load the CSV files.
* **Standardization:** Rename columns to a strict format: `['ax', 'ay', 'az', 'gx', 'gy', 'gz', 'label']`.
* **Resampling:** Ensure all data is resampled to **50Hz** (Period = 0.02s). If a dataset is 100Hz, downsample it.
* **Label Mapping:** Normalize labels to integers:
    * `0`: Smooth/Normal Road
    * `1`: Pothole
    * `2`: Speed Bump

### Step B: Preprocessing (The "Sensor Cleaning" Phase)
* **Gravity Filtering:** Implement a **High-Pass Filter** (Butterworth, cutoff=0.3Hz) on the Accelerometer data to remove the gravity component (static tilt) and keep only the dynamic vibration.
* **Sliding Window Segmentation:**
    * Create fixed-size windows of **2 seconds** (100 samples at 50Hz).
    * **Overlap:** Use 50% overlap (step size = 50 samples) to catch anomalies that happen on the edge of a window.
    * **Output Shape:** `(Total_Windows, 100, 6)` -> `(Samples, Timesteps, Features)`.

### Step C: Model Architecture (The TCN-BiLSTM)
Build the model using `TensorFlow/Keras`. The architecture must be exactly as follows:
1.  **Input Layer:** Shape `(100, 6)`.
2.  **TCN Block (Temporal Convolutional Network):**
    * Use `Conv1D` layers with `dilation_rate` increasing powers of 2 (1, 2, 4, 8).
    * *Filters:* 64, *Kernel Size:* 3, *Activation:* ReLU, *Padding:* Causal.
    * Add `SpatialDropout1D`.
3.  **BiLSTM Layer:**
    * `Bidirectional(LSTM(64, return_sequences=False))`.
4.  **Dense Layers:**
    * Dense(32, activation='relu').
    * Dropout(0.5).
    * **Output Layer:** Dense(3, activation='softmax') (for the 3 classes).

### Step D: Training
* **Split:** 70% Train, 15% Validation, 15% Test.
* **Class Balancing:** Calculate and apply `class_weights` because "Normal Road" data will vastly outnumber "Potholes."
* **Compilation:**
    * *Optimizer:* Adam (learning_rate=0.001).
    * *Loss:* Categorical Crossentropy.
    * *Metrics:* Accuracy, Precision, Recall, F1-Score.
* **Callbacks:** Add `EarlyStopping` (monitor='val_loss', patience=5) and `ModelCheckpoint` (save_best_only=True).

### Step E: Evaluation & Export
* Plot the **Confusion Matrix** on the Test Set.
* **TFLite Conversion (CRITICAL):**
    * Convert the trained Keras model (`.h5`) to TensorFlow Lite (`.tflite`).
    * Apply `tf.lite.Optimize.DEFAULT` (Quantization) to minimize file size for mobile deployment.
    * Save the final file as `road_sensing_model.tflite`.
