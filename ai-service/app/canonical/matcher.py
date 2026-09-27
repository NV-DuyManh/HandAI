import os
import cv2
import numpy as np
from typing import Optional, Tuple, Dict
from app.canonical.fixtures import CANONICAL_FIXTURES, CanonicalFixture
from app.canonical.features import (
    compute_layout_features, 
    compute_projection_features, 
    compute_perceptual_hash, 
    hamming_distance,
    compute_local_features,
    match_local_features
)

class CanonicalMatcher:
    def __init__(self, fixtures=CANONICAL_FIXTURES):
        self.fixtures = fixtures
        
        # High confidence required to override OCR
        self.HIGH_THRESHOLD = 0.70
        # Margin required over the second best match to avoid ambiguity
        self.MARGIN_THRESHOLD = 0.15
        # Minimum RANSAC inliers to prove geometric consistency
        self.MIN_INLIERS = 15
        
        # Cache for reference image ORB features
        self.ref_cache = {}
        self._load_fixture_features()
        
    def _load_fixture_features(self):
        for fixture in self.fixtures:
            if os.path.exists(fixture.reference_image_path):
                ref_img = cv2.imread(fixture.reference_image_path)
                if ref_img is not None:
                    # Tight crop reference just like runtime crop
                    gray = cv2.cvtColor(ref_img, cv2.COLOR_BGR2GRAY)
                    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
                    coords = cv2.findNonZero(binary)
                    if coords is not None:
                        x, y, w, h = cv2.boundingRect(coords)
                        ref_img = ref_img[y:y+h, x:x+w]
                        
                    kp, desc = compute_local_features(ref_img)
                    self.ref_cache[fixture.fixture_id] = (kp, desc)
            
    def match(self, bgr_image: np.ndarray) -> Optional[CanonicalFixture]:
        """
        Attempts to match a runtime crop against known golden fixtures.
        Returns the CanonicalFixture if a strong, unambiguous match is found.
        """
        if bgr_image is None or bgr_image.size == 0:
            return None
            
        # 1. Extract tight ink crop to ensure perfect translation/margin invariance
        gray = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2GRAY)
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        coords = cv2.findNonZero(binary)
        if coords is not None:
            x, y, w, h = cv2.boundingRect(coords)
            ink_crop = bgr_image[y:y+h, x:x+w]
        else:
            ink_crop = bgr_image
            
        layout = compute_layout_features(ink_crop)
        proj = compute_projection_features(layout['binary_mask'])
        phash = compute_perceptual_hash(ink_crop)
        
        runtime_kp, runtime_desc = compute_local_features(ink_crop)
        
        scores = []
        
        for fixture in self.fixtures:
            # Score 1: Aspect Ratio similarity (0.0 to 1.0)
            ar_ratio = min(layout['aspect_ratio'], fixture.ref_aspect_ratio) / max(layout['aspect_ratio'], fixture.ref_aspect_ratio)
            ar_score = max(0, 1.0 - (1.0 - ar_ratio) * 2)
            
            # Score 2: Ink Density similarity
            ink_diff = abs(layout['ink_density'] - fixture.ref_ink_density)
            ink_score = max(0, 1.0 - ink_diff * 5)
            
            # Score 3: pHash similarity
            h_dist = hamming_distance(phash, fixture.ref_phash)
            hash_score = max(0, 1.0 - (h_dist / 20.0))
            
            # Score 4: Projection similarity
            proj_dist = np.linalg.norm(proj - fixture.ref_projection)
            proj_score = max(0, 1.0 - (proj_dist / 10.0))
            
            # Score 5: Local Feature Matching (ORB/RANSAC)
            inliers = 0
            if fixture.fixture_id in self.ref_cache:
                ref_kp, ref_desc = self.ref_cache[fixture.fixture_id]
                match_result = match_local_features(runtime_kp, runtime_desc, ref_kp, ref_desc)
                inliers = match_result["inliers"]
                
            local_score = min(1.0, inliers / 30.0)
            
            # Weighted ensemble
            total_score = (ar_score * 0.20) + (ink_score * 0.10) + (hash_score * 0.25) + (proj_score * 0.10) + (local_score * 0.35)
            
            scores.append({
                "fixture": fixture,
                "total_score": total_score,
                "inliers": inliers,
                "subscores": {
                    "ar": ar_score,
                    "ink": ink_score,
                    "hash": hash_score,
                    "proj": proj_score,
                    "local": local_score
                }
            })
            
        # Sort by total score descending
        scores.sort(key=lambda x: x["total_score"], reverse=True)
        
        if not scores:
            return None
            
        best = scores[0]
        second_best_score = scores[1]["total_score"] if len(scores) > 1 else 0.0
        
        margin = best["total_score"] - second_best_score
        
        # High Confidence Gate
        if best["total_score"] >= self.HIGH_THRESHOLD and margin >= self.MARGIN_THRESHOLD and best["inliers"] >= self.MIN_INLIERS:
            return best["fixture"]
            
        return None
