"""
Script to download and prepare datasets for RoadSense training.
Downloads the Kaggle pothole dataset and prepares it for training.
"""
import os
import subprocess
import pandas as pd

# Create directories
os.makedirs("../raw_downloads", exist_ok=True)
os.makedirs("../raw_data", exist_ok=True)

print("=" * 60)
print("RoadSense Dataset Downloader")
print("=" * 60)

# Download Kaggle dataset
print("\n[1/3] Downloading Kaggle Pothole Dataset...")
print("Dataset: dextergoes/pothole-sensor-data")

try:
    # Download using kaggle CLI
    subprocess.run([
        "kaggle", "datasets", "download", "-d", "dextergoes/pothole-sensor-data",
        "-p", "../raw_downloads", "--unzip"
    ], check=True)
    print("✓ Kaggle dataset downloaded successfully")
except subprocess.CalledProcessError as e:
    print(f"✗ Error downloading Kaggle dataset: {e}")
    print("\nNote: Make sure you have:")
    print("1. Kaggle API credentials in ~/.kaggle/kaggle.json")
    print("2. Accepted the dataset terms on Kaggle website")
    print("\nYou can manually download from:")
    print("https://www.kaggle.com/datasets/dextergoes/pothole-sensor-data")
except FileNotFoundError:
    print("✗ Kaggle CLI not found. Installing...")
    subprocess.run(["pip", "install", "kaggle"], check=True)
    print("Please run this script again after setting up Kaggle credentials")

print("\n[2/3] Normalizing dataset format...")
# Look for CSV files in raw_downloads
download_dir = "../raw_downloads"
if os.path.exists(download_dir):
    csv_files = [f for f in os.listdir(download_dir) if f.endswith('.csv')]
    print(f"Found {len(csv_files)} CSV files")
    
    for csv_file in csv_files:
        try:
            filepath = os.path.join(download_dir, csv_file)
            df = pd.read_csv(filepath)
            print(f"\nProcessing: {csv_file}")
            print(f"Columns: {list(df.columns)}")
            print(f"Shape: {df.shape}")
            
            # Try to standardize column names
            # Common variations: AccX/Accel_X/accel_x -> ax
            column_mapping = {}
            for col in df.columns:
                col_lower = col.lower()
                if 'acc' in col_lower and 'x' in col_lower:
                    column_mapping[col] = 'ax'
                elif 'acc' in col_lower and 'y' in col_lower:
                    column_mapping[col] = 'ay'
                elif 'acc' in col_lower and 'z' in col_lower:
                    column_mapping[col] = 'az'
                elif 'gyro' in col_lower and 'x' in col_lower:
                    column_mapping[col] = 'gx'
                elif 'gyro' in col_lower and 'y' in col_lower:
                    column_mapping[col] = 'gy'
                elif 'gyro' in col_lower and 'z' in col_lower:
                    column_mapping[col] = 'gz'
                elif 'label' in col_lower or 'class' in col_lower:
                    column_mapping[col] = 'label'
                elif 'time' in col_lower:
                    column_mapping[col] = 'timestamp'
            
            if column_mapping:
                df = df.rename(columns=column_mapping)
                print(f"Renamed columns: {column_mapping}")
            
            # Save normalized version
            output_path = os.path.join("../raw_data", f"normalized_{csv_file}")
            df.to_csv(output_path, index=False)
            print(f"✓ Saved to: {output_path}")
            
        except Exception as e:
            print(f"✗ Error processing {csv_file}: {e}")

print("\n[3/3] Dataset preparation complete!")
print("\nNext steps:")
print("1. Review the normalized files in ml-pipeline/raw_data/")
print("2. Run: python train.py")
