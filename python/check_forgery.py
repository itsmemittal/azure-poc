import sys
import os
import hashlib
from PIL import Image
import cv2
from skimage import img_as_float, util

# Trusted hashes (replace with real values from your safe originals)
trusted_hashes = {
    "file1.png": "5d41402abc4b2a76b9719d911017c592",
    "file2.jpg": "098f6bcd4621d373cade4e832627b4f6"
}

def calculate_md5(file_path):
    hasher = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hasher.update(chunk)
    return hasher.hexdigest()

def basic_noise_check(file_path):
    """Very simple heuristic: measure image noise variance"""
    try:
        img = cv2.imread(file_path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            return False  # not an image
        img_float = img_as_float(img)
        noise = util.random_noise(img_float, mode="gaussian", var=0.01)
        diff = abs(noise - img_float).mean()
        # Arbitrary threshold for demo: if noise diff is suspiciously high, flag
        return diff > 0.2
    except Exception:
        return False

def check_file(file_path):
    file_name = os.path.basename(file_path)
    file_hash = calculate_md5(file_path)

    if file_name in trusted_hashes:
        if file_hash == trusted_hashes[file_name]:
            return "ok"
        else:
            return "forged"

    # If not in trusted list, run heuristic check
    if basic_noise_check(file_path):
        return "forged"
    return "ok"

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("error")
        sys.exit(1)

    file_path = sys.argv[1]
    result = check_file(file_path)
    print(result)
