import pandas as pd
import os

files = [
    'kaggle_unified.csv',
    'pothole_unified.csv', 
    'road_bad_unified.csv',
    'road_good_unified.csv',
    'roadsense_synthetic_gyro_dataset.csv',
    'synthetic_road_gyroscope_dataset_balanced.csv'
]

print("="*70)
print("Dataset Latitude/Longitude Verification")
print("="*70)

for f in files:
    path = f"../../raw_data/{f}"
    if os.path.exists(path):
        df = pd.read_csv(path, nrows=2)
        has_lat = 'latitude' in df.columns
        has_lon = 'longitude' in df.columns
        
        print(f"\n{f}")
        print(f"  Columns: {list(df.columns)}")
        print(f"  Has latitude: {'✓' if has_lat else '✗'}")
        print(f"  Has longitude: {'✓' if has_lon else '✗'}")
        
        if has_lat and has_lon:
            print(f"  Sample lat/lon: ({df['latitude'].iloc[0]:.6f}, {df['longitude'].iloc[0]:.6f})")

print("\n" + "="*70)
