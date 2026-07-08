#!/usr/bin/env python3
"""Download AI models for the avatar service.

Large model files are excluded from Git. This script downloads them on first run
so anyone who clones the repo can get the avatar service working.
"""

import os
import sys
import urllib.request
from pathlib import Path
from tqdm import tqdm

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"

# Model URLs and destinations
MODELS = {
    "wav2lip/wav2lip.onnx": {
        "url": "https://github.com/Rudrabha/Wav2Lip/releases/download/v1.0/wav2lip.onnx",
        "size": 145175471,
    },
    "wav2lip/wav2lip_gan.onnx": {
        "url": "https://github.com/Rudrabha/Wav2Lip/releases/download/v1.0/wav2lip_gan.onnx",
        "size": 145175471,
    },
    "face_detection/res10_300x300_ssd_iter_140000.caffemodel": {
        "url": "https://github.com/opencv/opencv_3rdparty/raw/dnn_samples_face_detector_20170830/res10_300x300_ssd_iter_140000.caffemodel",
        "size": 10666211,
    },
    "piper/en_US-amy-medium.onnx": {
        "url": "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/amy/medium/en_US-amy-medium.onnx",
        "size": 0,  # Unknown; download will show progress
    },
    "piper/en_US-amy-medium.onnx.json": {
        "url": "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/amy/medium/en_US-amy-medium.onnx.json",
        "size": 0,
    },
}


def download_file(url: str, dest: Path, expected_size: int = 0):
    """Download a file with a progress bar."""
    if dest.exists():
        actual_size = dest.stat().st_size
        if expected_size and actual_size == expected_size:
            print(f"✓ {dest.name} already downloaded")
            return
        print(f"! {dest.name} exists but size mismatch. Re-downloading...")

    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {dest.name}...")
    print(f"  URL: {url}")

    try:
        with urllib.request.urlopen(url, timeout=60) as response:
            total = int(response.headers.get("content-length", expected_size))
            chunk_size = 8192
            with open(dest, "wb") as f, tqdm(
                desc=dest.name,
                total=total,
                unit="B",
                unit_scale=True,
                unit_divisor=1024,
            ) as bar:
                while True:
                    chunk = response.read(chunk_size)
                    if not chunk:
                        break
                    f.write(chunk)
                    bar.update(len(chunk))
    except Exception as exc:
        if dest.exists():
            dest.unlink()
        print(f"✗ Failed to download {dest.name}: {exc}", file=sys.stderr)
        raise

    print(f"✓ Downloaded {dest.name}")


def main():
    missing = []
    for rel_path, info in MODELS.items():
        dest = MODELS_DIR / rel_path
        try:
            download_file(info["url"], dest, info.get("size", 0))
        except Exception as exc:
            missing.append((rel_path, str(exc)))

    if missing:
        print("\n✗ Some models failed to download:", file=sys.stderr)
        for rel_path, err in missing:
            print(f"  - {rel_path}: {err}", file=sys.stderr)
        sys.exit(1)

    print("\n✓ All models ready")


if __name__ == "__main__":
    main()
