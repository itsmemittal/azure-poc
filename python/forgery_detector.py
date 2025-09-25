import cv2
import numpy as np
from PIL import Image
from skimage import measure, filters
import json
import sys
import os

def detect_forgery(image_path):
    """
    Detect potential image forgery using multiple techniques
    """
    try:
        # Load image
        image = cv2.imread(image_path)
        if image is None:
            return {"success": False, "error": "Could not load image"}

        # Convert to different color spaces
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

        results = {
            "success": True,
            "analysis": {}
        }

        # 1. Error Level Analysis (ELA)
        ela_score = perform_ela(image_path)
        results["analysis"]["ela"] = ela_score

        # 2. Copy-Move Detection
        copy_move_score = detect_copy_move(gray)
        results["analysis"]["copy_move"] = copy_move_score

        # 3. Noise Analysis
        noise_score = analyze_noise(gray)
        results["analysis"]["noise"] = noise_score

        # 4. JPEG Compression Artifacts
        jpeg_score = analyze_jpeg_artifacts(image_path)
        results["analysis"]["jpeg_artifacts"] = jpeg_score

        # 5. Edge Inconsistency
        edge_score = analyze_edge_consistency(gray)
        results["analysis"]["edge_consistency"] = edge_score

        # Calculate overall forgery probability
        scores = [ela_score, copy_move_score, noise_score, jpeg_score, edge_score]
        avg_score = np.mean(scores)

        # Determine if image is likely forged
        is_forged = avg_score > 0.6

        results["analysis"]["overall_score"] = float(avg_score)
        results["analysis"]["is_likely_forged"] = bool(is_forged)
        results["analysis"]["confidence"] = "High" if avg_score > 0.8 else "Medium" if avg_score > 0.5 else "Low"

        return results

    except Exception as e:
        return {"success": False, "error": str(e)}

def perform_ela(image_path):
    """Error Level Analysis"""
    try:
        original = Image.open(image_path)
        original.save('temp_compressed.jpg', 'JPEG', quality=95)
        compressed = Image.open('temp_compressed.jpg')

        diff = np.array(original) - np.array(compressed)
        ela_score = np.mean(np.abs(diff)) / 255.0

        if os.path.exists('temp_compressed.jpg'):
            os.remove('temp_compressed.jpg')

        return float(ela_score)
    except:
        return 0.0

def detect_copy_move(gray_image):
    """Detect copy-move forgery"""
    try:
        sift = cv2.SIFT_create()
        keypoints, descriptors = sift.detectAndCompute(gray_image, None)

        if descriptors is None or len(descriptors) < 2:
            return 0.0

        bf = cv2.BFMatcher()
        matches = bf.knnMatch(descriptors, descriptors, k=2)

        good_matches = []
        for match_pair in matches:
            if len(match_pair) == 2:
                m, n = match_pair
                if m.distance < 0.7 * n.distance:
                    good_matches.append(m)

        similarity_score = len(good_matches) / len(keypoints) if len(keypoints) > 0 else 0
        return float(min(similarity_score, 1.0))
    except:
        return 0.0

def analyze_noise(gray_image):
    """Analyze noise patterns"""
    try:
        blurred = cv2.GaussianBlur(gray_image, (5, 5), 0)
        noise = gray_image.astype(np.float32) - blurred.astype(np.float32)
        noise_variance = np.var(noise)
        normalized_score = min(noise_variance / 1000.0, 1.0)
        return float(normalized_score)
    except:
        return 0.0

def analyze_jpeg_artifacts(image_path):
    """Analyze JPEG compression artifacts"""
    try:
        image = cv2.imread(image_path)
        yuv = cv2.cvtColor(image, cv2.COLOR_BGR2YUV)
        y_channel = yuv[:, :, 0]

        block_size = 8
        artifacts_score = 0.0
        block_count = 0

        for i in range(0, y_channel.shape[0] - block_size, block_size):
            for j in range(0, y_channel.shape[1] - block_size, block_size):
                block = y_channel[i:i+block_size, j:j+block_size]
                if block.shape == (block_size, block_size):
                    block_var = np.var(block)
                    artifacts_score += block_var
                    block_count += 1

        if block_count > 0:
            avg_artifacts = artifacts_score / block_count
            normalized_score = min(avg_artifacts / 1000.0, 1.0)
            return float(normalized_score)

        return 0.0
    except:
        return 0.0

def analyze_edge_consistency(gray_image):
    """Analyze edge consistency"""
    try:
        edges = cv2.Canny(gray_image, 50, 150)
        edge_density = np.sum(edges > 0) / (edges.shape[0] * edges.shape[1])
        edge_variance = np.var(edges)
        consistency_score = edge_density * (edge_variance / 10000.0)
        return float(min(consistency_score, 1.0))
    except:
        return 0.0

def main():
    """Main function for command line execution"""
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
        result = detect_forgery(image_path)
        print(json.dumps(result))
    else:
        print(json.dumps({"success": False, "error": "No image path provided"}))

if __name__ == "__main__":
    main()