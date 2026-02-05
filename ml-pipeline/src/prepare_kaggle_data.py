"""
Prepare Kaggle pothole dataset for training.
Combines Pothole and RoadCondition data into a unified format.
"""
import pandas as pd
import os
import glob

# Paths
RAW_DOWNLOADS = "../raw_downloads"
RAW_DATA_DIR = "../raw_data"

os.makedirs(RAW_DATA_DIR, exist_ok=True)

print("=" * 60)
print("Preparing Kaggle Pothole Dataset")
print("=" * 60)

# Find all CSV files
pothole_files = glob.glob(os.path.join(RAW_DOWNLOADS, "Pothole", "*.csv"))
road_files = glob.glob(os.path.join(RAW_DOWNLOADS, "RoadCondition", "*.csv"))

print(f"\nFound {len(pothole_files)} pothole files")
print(f"Found {len(road_files)} road condition files")

all_data = []

# Process Pothole files (label = 1)
for file in pothole_files:
    try:
        df = pd.read_csv(file)
        print(f"\nProcessing: {os.path.basename(file)}")
        print(f"Columns: {list(df.columns)}")
        print(f"Shape: {df.shape}")
        
        # Add label
        df['label'] = 1  # Pothole
        all_data.append(df)
    except Exception as e:
        print(f"Error: {e}")

# Process RoadCondition files (label = 0 for smooth)
for file in road_files:
    try:
        df = pd.read_csv(file)
        print(f"\nProcessing: {os.path.basename(file)}")
        print(f"Columns: {list(df.columns)}")
        print(f"Shape: {df.shape}")
        
        # Add label
        df['label'] = 0  # Smooth road
        all_data.append(df)
    except Exception as e:
        print(f"Error: {e}")

if all_data:
    # Combine all data
    combined_df = pd.concat(all_data, ignore_index=True)
    print(f"\n✓ Combined dataset shape: {combined_df.shape}")
    print(f"Columns: {list(combined_df.columns)}")
    
    # Standardize column names
    column_mapping = {}
    for col in combined_df.columns:
        col_lower = col.lower().replace(' ', '_')
        if 'acc' in col_lower and 'x' in col_lower:
            column_mapping[col] = 'ax'
        elif 'acc' in col_lower and 'z' in col_lower:  # Check Z before Y
            column_mapping[col] = 'az'
        elif 'acc' in col_lower and 'y' in col_lower:
            column_mapping[col] = 'ay'
        elif 'gyro' in col_lower and 'x' in col_lower:
            column_mapping[col] = 'gx'
        elif 'gyro' in col_lower and 'z' in col_lower:  # Check Z before Y
            column_mapping[col] = 'gz'
        elif 'gyro' in col_lower and 'y' in col_lower:
            column_mapping[col] = 'gy'
        elif 'time' in col_lower:
            column_mapping[col] = 'timestamp'
    
    if column_mapping:
        combined_df = combined_df.rename(columns=column_mapping)
        print(f"\n✓ Renamed columns: {column_mapping}")
    
    # Ensure we have required columns
    required_cols = ['ax', 'ay', 'az', 'gx', 'gy', 'gz', 'label']
    missing_cols = [col for col in required_cols if col not in combined_df.columns]
    
    if missing_cols:
        print(f"\n⚠ Missing columns: {missing_cols}")
        print("Available columns:", list(combined_df.columns))
    else:
        # Save unified dataset
        output_file = os.path.join(RAW_DATA_DIR, "kaggle_unified.csv")
        combined_df[required_cols].to_csv(output_file, index=False)
        print(f"\n✓ Saved unified dataset to: {output_file}")
        print(f"  - Total samples: {len(combined_df)}")
        print(f"  - Label distribution:")
        print(combined_df['label'].value_counts())
else:
    print("\n✗ No data files found!")

print("\n" + "=" * 60)
print("Dataset preparation complete!")
print("=" * 60)
