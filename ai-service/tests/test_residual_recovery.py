import cv2
import numpy as np
import os
import glob
from app.api.generalized_pipeline import run_generalized_line_detection

def run_tests():
    print("--- 5. RECOVER_MISSED_LAST_LINE TESTS ---")
    
    # Check if there is an image with 12 lines
    img_paths = glob.glob('../../scratch/*.png') + glob.glob('tests/fixtures/ocr_eval/*.png')
    target_img = None
    for p in img_paths:
        if 'SYNTHETIC_POEM_BLOCK_3' in p or 'Diều' in p:
            target_img = p
            break
            
    print(f"Using {target_img} for testing")
    if target_img:
        img = cv2.imread(target_img)
        lines, diag = run_generalized_line_detection(img)
        print(f"Detected {len(lines)} lines on {target_img}")
        
    print("Negative Test R1: Empty image")
    img_empty = np.zeros((800, 600, 3), dtype=np.uint8)
    lines, _ = run_generalized_line_detection(img_empty)
    print(f"Detected {len(lines)} lines on empty image")

    print("Negative Test R2: Privacy solid rectangle at bottom")
    img_privacy = np.zeros((800, 600, 3), dtype=np.uint8)
    img_privacy.fill(255) # white background
    # draw some text lines
    for i in range(3):
        cv2.putText(img_privacy, f"Text Line {i}", (50, 100 + i*100), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2)
    # solid rectangle at bottom
    cv2.rectangle(img_privacy, (20, 600), (580, 750), (0, 0, 0), -1)
    lines, _ = run_generalized_line_detection(img_privacy)
    print(f"Detected {len(lines)} lines on image with privacy block. Should not detect the block.")

    print("Negative Test R3: Grid/page border")
    img_border = np.zeros((800, 600, 3), dtype=np.uint8)
    img_border.fill(255)
    for i in range(3):
        cv2.putText(img_border, f"Text Line {i}", (50, 100 + i*100), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2)
    # draw thick line at bottom
    cv2.line(img_border, (0, 750), (600, 750), (0, 0, 0), 5)
    lines, _ = run_generalized_line_detection(img_border)
    print(f"Detected {len(lines)} lines on image with border line.")

if __name__ == '__main__':
    run_tests()
