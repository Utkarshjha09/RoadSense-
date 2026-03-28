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

def preprocess_gyro_only_dataset(filepath):
    """
    Preprocess datasets that only have gyroscope data (gyro_x, gyro_y, gyro_z)
    and road_condition labels. Adds synthetic accelerometer data.
    """
    try:
        df = pd.read_csv(filepath)
        
        # Check if this is a gyro-only dataset
        if 'gyro_x' not in df.columns or 'road_condition' not in df.columns:
            return None
            
        # Map road_condition to numeric labels
        condition_map = {
            'smooth': 0,
            'pothole': 1,
            'speed_bump': 2,
            'speedbump': 2,
            'bump': 2
        }
        
        df['label'] = df['road_condition'].str.lower().map(condition_map)
        
        # Drop rows with unmapped conditions
        df = df.dropna(subset=['label'])
        
        # Rename gyro columns
        df = df.rename(columns={
            'gyro_x': 'gx',
            'gyro_y': 'gy',
            'gyro_z': 'gz'
        })
        
        # Add synthetic accelerometer data
        # We'll add small random values with gravity component on Z-axis
        # This simulates a phone in portrait mode with slight vibrations
        df['ax'] = np.random.normal(0, 0.05, len(df))
        df['ay'] = np.random.normal(0, 0.05, len(df))
        df['az'] = np.random.normal(9.81, 0.1, len(df))  # Gravity + small variations
        
        # Add timestamp if missing
        if 'timestamp' not in df.columns:
            df['timestamp'] = np.arange(len(df)) / SAMPLING_RATE
        
        # Ensure latitude and longitude exist, or use defaults
        if 'latitude' not in df.columns:
            df['latitude'] = 0.0
        if 'longitude' not in df.columns:
            df['longitude'] = 0.0
        
        # Select required columns
        df = df[['timestamp', 'ax', 'ay', 'az', 'gx', 'gy', 'gz', 'latitude', 'longitude', 'label']]
        
        return df
        
    except Exception as e:
        print(f"Error preprocessing gyro-only dataset: {e}")
        return None

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
                
                # Check for required columns (now includes lat/lon)
                required_cols = ['ax', 'ay', 'az', 'gx', 'gy', 'gz', 'latitude', 'longitude', 'label']
                if not all(col in df.columns for col in required_cols):
                    # Try to preprocess as gyro-only dataset
                    df_processed = preprocess_gyro_only_dataset(filepath)
                    if df_processed is None:
                        # Try adding missing lat/lon to existing datasets
                        basic_cols = ['ax', 'ay', 'az', 'gx', 'gy', 'gz', 'label']
                        if all(col in df.columns for col in basic_cols):
                            print(f"Adding default lat/lon to {filename}...")
                            if 'latitude' not in df.columns:
                                df['latitude'] = 0.0
                            if 'longitude' not in df.columns:
                                df['longitude'] = 0.0
                        else:
                            print(f"Skipping {filename}: Missing columns. Expected {required_cols}")
                            continue
                    else:
                        print(f"✓ Converted gyro-only dataset: {filename} ({len(df_processed)} samples)")
                        df = df_processed
                
                # Keep only required columns and clean missing sensor samples.
                df = df[required_cols].copy()
                sensor_cols = ['ax', 'ay', 'az', 'gx', 'gy', 'gz', 'latitude', 'longitude']
                df[sensor_cols] = (
                    df[sensor_cols]
                    .interpolate(method='linear', limit_direction='both')
                    .ffill()
                    .bfill()
                )

                # Preprocessing
                # 1. Resample to 50Hz if needed (Not implemented here, assuming 50Hz for now or handled in unification)
                
                # 2. Gravity Filtering (High-Pass on Accel Only)
                acc_cols = ['ax', 'ay', 'az']
                df[acc_cols] = apply_high_pass_filter(df[acc_cols].values, cutoff=0.3, fs=SAMPLING_RATE)
                
                # 3. Normalize lat/lon (keep them as features without filtering)
                # Convert to relative coordinates for better learning
                if df['latitude'].nunique() > 1:
                    df['latitude'] = (df['latitude'] - df['latitude'].mean()) / (df['latitude'].std() + 1e-8)
                if df['longitude'].nunique() > 1:
                    df['longitude'] = (df['longitude'] - df['longitude'].mean()) / (df['longitude'].std() + 1e-8)
                
                # Create Windows
                for i in range(0, len(df) - WINDOW_SIZE, STEP_SIZE):
                    window = df.iloc[i : i + WINDOW_SIZE]
                    
                    if len(window) < WINDOW_SIZE:
                        continue

                    # Features (now includes lat/lon)
                    features = window[['ax', 'ay', 'az', 'gx', 'gy', 'gz', 'latitude', 'longitude']].values
                    if not np.isfinite(features).all():
                        continue
                    X.append(features)
                    
                    # Label (Majority vote in window)
                    labels = window['label'].values
                    mode_label = stats.mode(labels)[0]
                    # Handle Scalar vs Array return type of stats.mode
                    if isinstance(mode_label, np.ndarray):
                        mode_label = mode_label[0]
                        
                    if np.isfinite(mode_label):
                        y.append(mode_label)
                    
            except Exception as e:
                print(f"Error processing {filename}: {e}")

    if len(X) == 0:
        return np.array(X), np.array(y)

    X_arr = np.asarray(X, dtype=np.float32)
    y_arr = np.asarray(y, dtype=np.int32)
    finite_mask = np.isfinite(X_arr).all(axis=(1, 2)) & np.isfinite(y_arr)
    return X_arr[finite_mask], y_arr[finite_mask]

def create_synthetic_data(num_samples=1000):
    """Generate synthetic data matching the new shape (100, 8) with lat/lon"""
    print("Generating synthetic data...")
    X = np.random.randn(num_samples, WINDOW_SIZE, 8)
    y = np.random.randint(0, 3, size=(num_samples,))
    return X, y

if __name__ == "__main__":
    # Test
    X, y = create_synthetic_data(10)
    print(f"Generated shape: X={X.shape}, y={y.shape}")
