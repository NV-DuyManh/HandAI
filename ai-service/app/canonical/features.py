import cv2
import numpy as np

def compute_layout_features(bgr_image: np.ndarray):
    """
    Computes global structural features: aspect ratio and ink density.
    Uses the bounding box of the ink to ensure crop-invariance.
    """
    gray = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2GRAY)
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    
    coords = cv2.findNonZero(binary)
    if coords is not None:
        x, y, w, h = cv2.boundingRect(coords)
    else:
        h, w = bgr_image.shape[:2]
        
    aspect_ratio = w / float(max(1, h))
    
    ink_pixels = cv2.countNonZero(binary)
    ink_density = ink_pixels / float(max(1, w * h))
    
    return {
        "aspect_ratio": aspect_ratio,
        "ink_density": ink_density,
        "binary_mask": binary
    }

def compute_projection_features(binary_mask: np.ndarray, num_bins: int = 100):
    """
    Computes a normalized horizontal projection histogram.
    This captures the rhythm of handwriting rows regardless of image size.
    """
    h = binary_mask.shape[0]
    proj = np.sum(binary_mask, axis=1)
    
    # Normalize projection sum
    max_val = np.max(proj) if np.max(proj) > 0 else 1
    proj_norm = proj / max_val
    
    # Resize to fixed number of bins for scale-invariant comparison
    proj_2d = proj_norm.reshape(-1, 1).astype(np.float32)
    proj_binned = cv2.resize(proj_2d, (1, num_bins), interpolation=cv2.INTER_AREA)
    
    return proj_binned.flatten()

def compute_perceptual_hash(bgr_image: np.ndarray, hash_size: int = 8) -> int:
    """
    Computes a simple difference hash (dHash) for the image.
    Robust to slight lighting and crop variations.
    """
    gray = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2GRAY)
    resized = cv2.resize(gray, (hash_size + 1, hash_size))
    
    diff = resized[:, 1:] > resized[:, :-1]
    return sum([2 ** i for (i, v) in enumerate(diff.flatten()) if v])

def hamming_distance(hash1: int, hash2: int) -> int:
    """Computes Hamming distance between two integer hashes."""
    return bin(hash1 ^ hash2).count('1')

def compute_local_features(bgr_image: np.ndarray):
    """
    Computes ORB keypoints and descriptors for local invariant matching.
    Returns (keypoints, descriptors)
    """
    orb = cv2.ORB_create(nfeatures=500)
    gray = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2GRAY)
    keypoints, descriptors = orb.detectAndCompute(gray, None)
    return keypoints, descriptors

def match_local_features(kp1, desc1, kp2, desc2) -> dict:
    """
    Matches local features using BFMatcher and verifies geometric consistency using RANSAC.
    Returns the number of inliers and the homography matrix (if sufficient inliers found).
    """
    if desc1 is None or desc2 is None or len(kp1) < 4 or len(kp2) < 4:
        return {"inliers": 0, "homography": None}
        
    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    matches = bf.match(desc1, desc2)
    matches = sorted(matches, key=lambda x: x.distance)
    
    # We need at least 4 matches to compute homography
    if len(matches) < 4:
        return {"inliers": len(matches), "homography": None}
        
    src_pts = np.float32([kp1[m.queryIdx].pt for m in matches]).reshape(-1, 1, 2)
    dst_pts = np.float32([kp2[m.trainIdx].pt for m in matches]).reshape(-1, 1, 2)
    
    M, mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 5.0)
    
    if mask is None:
        inliers_count = 0
    else:
        inliers_count = np.sum(mask)
        
    return {"inliers": inliers_count, "homography": M}
