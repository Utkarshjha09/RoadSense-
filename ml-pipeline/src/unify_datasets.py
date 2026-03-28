import pandas as pd
import os
import numpy as np

# Helper to Unify Datasets into the standard format:
# timestamp, ax, ay, az, gx, gy, gz, label
# Label Mapping: 0=Smooth, 1=Pothole, 2=SpeedBump

INPUT_DIR = "../../raw_downloads"
OUTPUT_DIR = "../../raw_data"

def process_pothole_datasets():
    """
    Process Pothole dataset files (trip*_sensors.csv and trip*_potholes.csv)
    Label: 1 (Pothole)
    """
    pothole_dir = os.path.join(INPUT_DIR, "Pothole")
    if not os.path.exists(pothole_dir):
        print(f"Pothole directory not found: {pothole_dir}")
        return
    
    all_pothole_data = []
    
    # Process each trip
    for i in range(1, 6):  # trip1 to trip5
        sensors_file = os.path.join(pothole_dir, f"trip{i}_sensors.csv")
        potholes_file = os.path.join(pothole_dir, f"trip{i}_potholes.csv")
        
        if not os.path.exists(sensors_file):
            print(f"Sensors file not found: {sensors_file}")
            continue
            
        try:
            # Read sensors data
            df_sensors = pd.read_csv(sensors_file)
            
            # Rename columns to standard format
            df_sensors = df_sensors.rename(columns={
                'accelerometerX': 'ax',
                'accelerometerY': 'ay',
                'accelerometerZ': 'az',
                'gyroX': 'gx',
                'gyroY': 'gy',
                'gyroZ': 'gz'
            })
            
            # Read pothole timestamps if available
            pothole_timestamps = set()
            if os.path.exists(potholes_file):
                df_potholes = pd.read_csv(potholes_file)
                if 'timestamp' in df_potholes.columns:
                    pothole_timestamps = set(df_potholes['timestamp'].values)
            
            # Label data: 1 if timestamp matches pothole, 0 otherwise (smooth)
            df_sensors['label'] = df_sensors['timestamp'].apply(
                lambda t: 1 if t in pothole_timestamps or len(pothole_timestamps) == 0 else 0
            )
            
            # If no pothole timestamps found, label all as pothole (trip contains potholes)
            if len(pothole_timestamps) == 0:
                df_sensors['label'] = 1
            
            # Ensure latitude and longitude columns exist
            if 'latitude' not in df_sensors.columns:
                df_sensors['latitude'] = 0.0
            if 'longitude' not in df_sensors.columns:
                df_sensors['longitude'] = 0.0
            
            # Select only needed columns (now includes lat/lon)
            df_processed = df_sensors[['timestamp', 'ax', 'ay', 'az', 'gx', 'gy', 'gz', 'latitude', 'longitude', 'label']]
            
            # Remove rows with missing values
            df_processed = df_processed.dropna()
            
            all_pothole_data.append(df_processed)
            print(f"Processed {sensors_file}: {len(df_processed)} samples")
            
        except Exception as e:
            print(f"Error processing trip{i}: {e}")
    
    # Combine all pothole data
    if all_pothole_data:
        combined_df = pd.concat(all_pothole_data, ignore_index=True)
        output_path = os.path.join(OUTPUT_DIR, "pothole_unified.csv")
        combined_df.to_csv(output_path, index=False)
        print(f"✓ Saved pothole dataset: {output_path} ({len(combined_df)} samples)")
        return len(combined_df)
    return 0

def process_road_condition_datasets():
    """
    Process RoadCondition dataset files (good*_sensors.csv and bad*_sensors.csv)
    Label: 0 for good roads (Smooth), 1 for bad roads (Pothole/rough)
    """
    road_dir = os.path.join(INPUT_DIR, "RoadCondition")
    if not os.path.exists(road_dir):
        print(f"RoadCondition directory not found: {road_dir}")
        return
    
    good_data = []
    bad_data = []
    
    # Process good road files
    for filename in os.listdir(road_dir):
        if not filename.endswith("_sensors.csv"):
            continue
            
        filepath = os.path.join(road_dir, filename)
        
        try:
            df = pd.read_csv(filepath)
            
            # Rename columns to standard format
            df = df.rename(columns={
                'accelerometerX': 'ax',
                'accelerometerY': 'ay',
                'accelerometerZ': 'az',
                'gyroX': 'gx',
                'gyroY': 'gy',
                'gyroZ': 'gz'
            })
            
            # Determine label based on filename
            if filename.startswith('good'):
                df['label'] = 0  # Smooth road
                good_data.append(df)
            elif filename.startswith('bad'):
                df['label'] = 1  # Bad road (Pothole/rough)
                bad_data.append(df)
            
            print(f"Processed {filename}: {len(df)} samples")
            
        except Exception as e:
            print(f"Error processing {filename}: {e}")
    
    # Combine and save good road data
    if good_data:
        combined_good = pd.concat(good_data, ignore_index=True)
        # Ensure lat/lon columns exist
        if 'latitude' not in combined_good.columns:
            combined_good['latitude'] = 0.0
        if 'longitude' not in combined_good.columns:
            combined_good['longitude'] = 0.0
        combined_good = combined_good[['timestamp', 'ax', 'ay', 'az', 'gx', 'gy', 'gz', 'latitude', 'longitude', 'label']]
        combined_good = combined_good.dropna()
        output_path = os.path.join(OUTPUT_DIR, "road_good_unified.csv")
        combined_good.to_csv(output_path, index=False)
        print(f"✓ Saved good road dataset: {output_path} ({len(combined_good)} samples)")
    
    # Combine and save bad road data
    if bad_data:
        combined_bad = pd.concat(bad_data, ignore_index=True)
        # Ensure lat/lon columns exist
        if 'latitude' not in combined_bad.columns:
            combined_bad['latitude'] = 0.0
        if 'longitude' not in combined_bad.columns:
            combined_bad['longitude'] = 0.0
        combined_bad = combined_bad[['timestamp', 'ax', 'ay', 'az', 'gx', 'gy', 'gz', 'latitude', 'longitude', 'label']]
        combined_bad = combined_bad.dropna()
        output_path = os.path.join(OUTPUT_DIR, "road_bad_unified.csv")
        combined_bad.to_csv(output_path, index=False)
        print(f"✓ Saved bad road dataset: {output_path} ({len(combined_bad)} samples)")
    
    return len(good_data), len(bad_data)

def normalize_kaggle_dataset(file_path):
    """
    Example normalizer for Kaggle Pothole dataset.
    Adjust column names based on specific dataset.
    """
    try:
        df = pd.read_csv(file_path)
        # Rename columns to standard (example mapping, verify with actual CSV)
        # Assumes dataset has generic names like 'Time', 'AccX', etc.
        # This is a template - MODIFY based on the actual downloaded file headers.
        
        # Example transformation:
        # df = df.rename(columns={'Time': 'timestamp', 'AccX': 'ax', ...})
        
        # Add label if missing or map string labels to int
        # df['label'] = 1 # Force label if file is pure pothole data
        
        output_path = os.path.join(OUTPUT_DIR, "normalized_" + os.path.basename(file_path))
        df.to_csv(output_path, index=False)
        print(f"Normalized {file_path} -> {output_path}")
    except Exception as e:
        print(f"Error normalizing {file_path}: {e}")

if __name__ == "__main__":
    # Create output folder
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    print("="*60)
    print("Starting Dataset Unification Pipeline")
    print("="*60)
    
    # Process Pothole datasets
    print("\n[1/2] Processing Pothole datasets...")
    process_pothole_datasets()
    
    # Process RoadCondition datasets
    print("\n[2/2] Processing RoadCondition datasets...")
    process_road_condition_datasets()
    
    print("\n" + "="*60)
    print("Dataset unification complete!")
    print(f"Check {OUTPUT_DIR} for unified CSV files")
    print("="*60)
