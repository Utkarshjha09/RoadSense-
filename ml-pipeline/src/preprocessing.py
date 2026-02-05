import pandas as pd
import numpy as np
import os
from scipy import stats, signal

# Constants
WINDOW_SIZE = 100  # 2 seconds at 50Hz (changed from 128)
STEP_SIZE = 50     # 50% overlap (changed from 64)
SAMPLING_RATE = 50 # Hz

LABELS = {
    'Smooth': 0,
    'Pothole': 1,
    'SpeedBump': 2
}

def apply_high_pass_filter(data, cutoff=0.3, fs=50, order=4):
    """
    Applies a Butterworth High-Pass filter to remove gravity (static component).
    """
    nyquist = 0.5 * fs
    normal_cutoff = cutoff / nyquist
    b, a = signal.butter(order, normal_cutoff, btype='high', analog=False)
    filtered_data = signal.filtfilt(b, a, data, axis=0)
    return filtered_data

def load_and_preprocess_data(data_dir):
    """
    Loads CSV files from data_dir, resamples to 50Hz, applies HP filtering, and creates sliding windows.
    Expected CSV columns: timestamp, ax, ay, az, gx, gy, gz, label
    """
    X = []
    y = []
    
    print(f"Scanning {data_dir} for CSV files...")
    
    if not os.path.exists(data_dir):
        print(f"Directory {data_dir} not found. Returning empty arrays.")
        return np.array(X), np.array(y)

    for filename in os.listdir(data_dir):
        if filename.endswith(".csv"):
            filepath = os.path.join(data_dir, filename)
            try:
                df = pd.read_csv(filepath)
                print(f"Processing {filename}...")
                
                # Check for required columns
                required_cols = ['ax', 'ay', 'az', 'gx', 'gy', 'gz', 'label']
                if not all(col in df.columns for col in required_cols):
                    # Try to map columns if standard names aren't found (Simple heuristic)
                    # For now, just skip
                    print(f"Skipping {filename}: Missing columns. Expected {required_cols}")
                    continue
                
                # Preprocessing
                # 1. Resample to 50Hz if needed (Not implemented here, assuming 50Hz for now or handled in unification)
                
                # 2. Gravity Filtering (High-Pass on Accel Only)
                acc_cols = ['ax', 'ay', 'az']
                df[acc_cols] = apply_high_pass_filter(df[acc_cols].values, cutoff=0.3, fs=SAMPLING_RATE)
                
                # Create Windows
                for i in range(0, len(df) - WINDOW_SIZE, STEP_SIZE):
                    window = df.iloc[i : i + WINDOW_SIZE]
                    
                    if len(window) < WINDOW_SIZE:
                        continue

                    # Features
                    features = window[['ax', 'ay', 'az', 'gx', 'gy', 'gz']].values
                    X.append(features)
                    
                    # Label (Majority vote in window)
                    labels = window['label'].values
                    mode_label = stats.mode(labels)[0]
                    # Handle Scalar vs Array return type of stats.mode
                    if isinstance(mode_label, np.ndarray):
                        mode_label = mode_label[0]
                        
                    y.append(mode_label)
                    
            except Exception as e:
                print(f"Error processing {filename}: {e}")

    return np.array(X), np.array(y)

def create_synthetic_data(num_samples=1000):
    """Generate synthetic data matching the new shape (100, 6)"""
    print("Generating synthetic data...")
    X = np.random.randn(num_samples, WINDOW_SIZE, 6)
    y = np.random.randint(0, 3, size=(num_samples,))
    return X, y

if __name__ == "__main__":
    # Test
    X, y = create_synthetic_data(10)
    print(f"Generated shape: X={X.shape}, y={y.shape}")
