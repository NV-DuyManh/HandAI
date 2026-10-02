from pathlib import Path

import cv2

from app.api.generalized_pipeline import clear_detection_cache
from app.api.ocr import detect_text_lines


def test_owner_poem_detects_all_twelve_lines():
    image_path = Path(__file__).parent / "fixtures" / "real_hw" / "OWNER_POEM_12_LINES.png"
    image = cv2.imread(str(image_path))
    assert image is not None

    clear_detection_cache()
    lines, diagnostics = detect_text_lines(image, max_lines=30, force_redetect=True)

    assert len(lines) == 12
    assert diagnostics["chromatic_projection_used"] is True
    assert [line.order for line in lines] == list(range(1, 13))
    assert all(first.y < second.y for first, second in zip(lines, lines[1:]))
