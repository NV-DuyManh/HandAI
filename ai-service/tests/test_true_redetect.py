import os
import cv2
import app.api.generalized_pipeline as gp

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
img_path = os.path.join(base_dir, 'tests', 'fixtures', 'canonical_handwriting', 'OWNER_POEM_BLOCK_1.png')
if not os.path.exists(img_path):
    img_path = os.path.join(base_dir, 'tests', 'fixtures', 'ocr_eval', 'OWNER_POEM_BLOCK_1.png')
img = cv2.imread(img_path)

def run():
    print("=== FIRST REQUEST (forceRedetect=false) ===")
    lines1, diag1 = gp.run_generalized_line_detection(img, force_redetect=False)
    print("Run ID:", diag1["detectionRunId"])
    print("Cache Hit:", diag1["cacheHit"])

    print("\n=== SECOND REQUEST (forceRedetect=true) ===")
    lines2, diag2 = gp.run_generalized_line_detection(img, force_redetect=True)
    print("Run ID:", diag2["detectionRunId"])
    print("Cache Hit:", diag2["cacheHit"])
    
    print("\n=== RESULTS ===")
    print("Different Run ID:", diag1["detectionRunId"] != diag2["detectionRunId"])

if __name__ == "__main__":
    run()



# clean file
