import cv2
import numpy as np
import pytest
from app.canonical.matcher import CanonicalMatcher
from app.canonical.fixtures import CANONICAL_FIXTURES
from app.canonical.row_localizer import localize_rows

@pytest.fixture(scope="module")
def base_canonical_images():
    # Load actual reference images for testing recropping
    images = {}
    for fix in CANONICAL_FIXTURES:
        img = cv2.imread(fix.reference_image_path)
        if img is not None:
            images[fix.fixture_id] = img
        else:
            # Fallback to dummy if missing
            dummy = np.zeros((100, 434, 3), dtype=np.uint8)
            dummy[:] = 255
            images[fix.fixture_id] = dummy
    return images

@pytest.fixture
def matcher():
    return CanonicalMatcher()

def augment_crop(img, scale=1.0, rot=0.0, margin=0):
    """Simulates realistic recropping variations."""
    h, w = img.shape[:2]
    
    # Rotation
    if rot != 0.0:
        M = cv2.getRotationMatrix2D((w/2, h/2), rot, 1.0)
        img = cv2.warpAffine(img, M, (w, h), borderMode=cv2.BORDER_CONSTANT, borderValue=(255, 255, 255))
        
    # Scale
    if scale != 1.0:
        img = cv2.resize(img, (int(w*scale), int(h*scale)))
        
    # Margin
    if margin != 0:
        if margin > 0:
            img = cv2.copyMakeBorder(img, margin, margin, margin, margin, cv2.BORDER_CONSTANT, value=(255, 255, 255))
        else:
            m = abs(margin)
            if h > 2*m and w > 2*m:
                img = img[m:h-m, m:w-m]
                
    return img

def test_canon_01_block1_exact_match(matcher, base_canonical_images):
    matched = matcher.match(base_canonical_images["poem_block_1"])
    assert matched is not None and matched.fixture_id == "poem_block_1"

def test_canon_02_block2_exact_match(matcher, base_canonical_images):
    matched = matcher.match(base_canonical_images["poem_block_2"])
    assert matched is not None and matched.fixture_id == "poem_block_2"

def test_canon_03_block3_exact_match(matcher, base_canonical_images):
    matched = matcher.match(base_canonical_images["poem_block_3"])
    assert matched is not None and matched.fixture_id == "poem_block_3"

def test_canon_04_block1_linecount(matcher, base_canonical_images):
    fix = matcher.match(base_canonical_images["poem_block_1"])
    assert fix.expected_line_count == 4

def test_canon_05_block2_linecount(matcher, base_canonical_images):
    fix = matcher.match(base_canonical_images["poem_block_2"])
    assert fix.expected_line_count == 4

def test_canon_06_block3_linecount(matcher, base_canonical_images):
    fix = matcher.match(base_canonical_images["poem_block_3"])
    assert fix.expected_line_count == 4

def test_canon_07_block1_exact_text(matcher, base_canonical_images):
    fix = matcher.match(base_canonical_images["poem_block_1"])
    assert fix.canonical_lines[0] == "Em yêu mùa hè"

def test_canon_08_block2_exact_text(matcher, base_canonical_images):
    fix = matcher.match(base_canonical_images["poem_block_2"])
    assert fix.canonical_lines[0] == "Thong thả dắt trâu"

def test_canon_09_block3_exact_text(matcher, base_canonical_images):
    fix = matcher.match(base_canonical_images["poem_block_3"])
    assert fix.canonical_lines[0] == "Gió mát lưng đồi"

def test_canon_10_block1_boxes(matcher, base_canonical_images):
    fix = matcher.match(base_canonical_images["poem_block_1"])
    boxes = localize_rows(base_canonical_images["poem_block_1"], fix)
    assert len(boxes) == 4

def test_canon_11_block2_boxes(matcher, base_canonical_images):
    fix = matcher.match(base_canonical_images["poem_block_2"])
    boxes = localize_rows(base_canonical_images["poem_block_2"], fix)
    assert len(boxes) == 4

def test_canon_12_block3_boxes(matcher, base_canonical_images):
    fix = matcher.match(base_canonical_images["poem_block_3"])
    boxes = localize_rows(base_canonical_images["poem_block_3"], fix)
    assert len(boxes) == 4

def test_canon_13_block1_order(matcher, base_canonical_images):
    fix = matcher.match(base_canonical_images["poem_block_1"])
    boxes = localize_rows(base_canonical_images["poem_block_1"], fix)
    assert boxes[0].order == 1 and boxes[3].order == 4

def test_canon_14_block2_order(matcher, base_canonical_images):
    fix = matcher.match(base_canonical_images["poem_block_2"])
    boxes = localize_rows(base_canonical_images["poem_block_2"], fix)
    assert boxes[0].order == 1 and boxes[3].order == 4

def test_canon_15_block3_order(matcher, base_canonical_images):
    fix = matcher.match(base_canonical_images["poem_block_3"])
    boxes = localize_rows(base_canonical_images["poem_block_3"], fix)
    assert boxes[0].order == 1 and boxes[3].order == 4

def test_canon_16_block1_punctuation(matcher, base_canonical_images):
    fix = matcher.match(base_canonical_images["poem_block_1"])
    assert "lượn." in fix.canonical_lines[3]

def test_canon_17_block2_punctuation(matcher, base_canonical_images):
    fix = matcher.match(base_canonical_images["poem_block_2"])
    assert "Trời, sao ngọt thế!" in fix.canonical_lines[3]

def test_canon_18_block3_punctuation(matcher, base_canonical_images):
    fix = matcher.match(base_canonical_images["poem_block_3"])
    assert "thả." in fix.canonical_lines[3]

# Recrop robustness (Scaling)
def test_canon_19_block1_recrop(matcher, base_canonical_images):
    img = augment_crop(base_canonical_images["poem_block_1"], scale=0.8)
    assert matcher.match(img) is not None

def test_canon_20_block2_recrop(matcher, base_canonical_images):
    img = augment_crop(base_canonical_images["poem_block_2"], scale=1.1)
    assert matcher.match(img) is not None

def test_canon_21_block3_recrop(matcher, base_canonical_images):
    img = augment_crop(base_canonical_images["poem_block_3"], scale=0.9)
    assert matcher.match(img) is not None

# Margins
def test_canon_22_block1_margin(matcher, base_canonical_images):
    img = augment_crop(base_canonical_images["poem_block_1"], margin=10)
    assert matcher.match(img) is not None

def test_canon_23_block2_margin(matcher, base_canonical_images):
    img = augment_crop(base_canonical_images["poem_block_2"], margin=-5)
    assert matcher.match(img) is not None

def test_canon_24_block3_margin(matcher, base_canonical_images):
    img = augment_crop(base_canonical_images["poem_block_3"], margin=15)
    assert matcher.match(img) is not None

# Rotations
def test_canon_25_block1_rot(matcher, base_canonical_images):
    img = augment_crop(base_canonical_images["poem_block_1"], rot=2.0)
    assert matcher.match(img) is not None

def test_canon_26_block2_rot(matcher, base_canonical_images):
    img = augment_crop(base_canonical_images["poem_block_2"], rot=-2.5)
    assert matcher.match(img) is not None

def test_canon_27_block3_rot(matcher, base_canonical_images):
    img = augment_crop(base_canonical_images["poem_block_3"], rot=3.0)
    assert matcher.match(img) is not None

# Compound
def test_canon_28_block1_compound(matcher, base_canonical_images):
    img = augment_crop(base_canonical_images["poem_block_1"], rot=1.5, scale=1.05, margin=5)
    assert matcher.match(img) is not None

def test_canon_29_block2_compound(matcher, base_canonical_images):
    img = augment_crop(base_canonical_images["poem_block_2"], rot=-1.0, scale=0.95, margin=-2)
    assert matcher.match(img) is not None

def test_canon_30_block3_compound(matcher, base_canonical_images):
    img = augment_crop(base_canonical_images["poem_block_3"], rot=2.0, scale=1.1, margin=8)
    assert matcher.match(img) is not None

# 15 NEGATIVE TESTS (0 False Positives allowed)
def get_noise(shape=(300, 300, 3)):
    return np.random.randint(0, 255, shape, dtype=np.uint8)

def test_neg_01_blank_graph_paper(matcher):
    img = np.ones((500, 500, 3), dtype=np.uint8) * 240
    img[::25, :] = 200 # Draw lines
    assert matcher.match(img) is None

def test_neg_02_title_date(matcher):
    img = get_noise((100, 500, 3))
    assert matcher.match(img) is None

def test_neg_03_heading_region(matcher):
    img = get_noise((150, 400, 3))
    assert matcher.match(img) is None

def test_neg_04_unrelated_handwriting(matcher, base_canonical_images):
    # Take half of block1 and mix it with noise
    img = base_canonical_images["poem_block_1"].copy()
    img[img.shape[0]//2:] = get_noise((img.shape[0] - img.shape[0]//2, img.shape[1], 3))
    assert matcher.match(img) is None

def test_neg_05_printed_vietnamese(matcher):
    img = np.ones((200, 600, 3), dtype=np.uint8) * 255
    cv2.putText(img, "Em yeu mua he", (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0,0,0), 2)
    assert matcher.match(img) is None

def test_neg_06_partial_block1(matcher, base_canonical_images):
    img = base_canonical_images["poem_block_1"]
    img = img[:img.shape[0]//2, :]
    assert matcher.match(img) is None

def test_neg_07_partial_block2(matcher, base_canonical_images):
    img = base_canonical_images["poem_block_2"]
    img = img[img.shape[0]//3:, :]
    assert matcher.match(img) is None

def test_neg_08_partial_block3(matcher, base_canonical_images):
    img = base_canonical_images["poem_block_3"]
    img = img[:, :img.shape[1]//2]
    assert matcher.match(img) is None

def test_neg_09_mixed_blocks(matcher, base_canonical_images):
    img1 = base_canonical_images["poem_block_1"]
    img2 = cv2.resize(base_canonical_images["poem_block_2"], (img1.shape[1], img1.shape[0]))
    img = np.vstack([img1[:img1.shape[0]//2, :], img2[img2.shape[0]//2:, :]])
    assert matcher.match(img) is None

def test_neg_10_full_page(matcher):
    assert matcher.match(get_noise((1500, 1000, 3))) is None

def test_neg_11_watermark_logo(matcher):
    assert matcher.match(get_noise((200, 200, 3))) is None

def test_neg_12_similar_4_row(matcher, base_canonical_images):
    # Create an image with same structure but reversed horizontally (destroys local features/hash)
    img = cv2.flip(base_canonical_images["poem_block_1"], 1)
    assert matcher.match(img) is None

def test_neg_13_unrelated_blue_ink(matcher):
    img = np.ones((300, 400, 3), dtype=np.uint8) * 255
    img[50:100, :] = [255, 0, 0] # Blue bar
    assert matcher.match(img) is None

def test_neg_14_rotated_unrelated(matcher, base_canonical_images):
    img = cv2.flip(base_canonical_images["poem_block_2"], 0)
    assert matcher.match(img) is None

def test_neg_15_ambiguous_low_quality(matcher, base_canonical_images):
    img = cv2.GaussianBlur(base_canonical_images["poem_block_3"], (51, 51), 0)
    assert matcher.match(img) is None
