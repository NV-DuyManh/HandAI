from typing import List, Optional
import numpy as np
import os
from pathlib import Path

class CanonicalFixture:
    def __init__(
        self,
        fixture_id: str,
        expected_line_count: int,
        canonical_lines: List[str],
        ref_aspect_ratio: float,
        ref_ink_density: float,
        ref_phash: int,
        ref_projection: List[float],
        reference_image_path: str
    ):
        self.fixture_id = fixture_id
        self.expected_line_count = expected_line_count
        self.canonical_lines = canonical_lines
        self.ref_aspect_ratio = ref_aspect_ratio
        self.ref_ink_density = ref_ink_density
        self.ref_phash = ref_phash
        self.ref_projection = np.array(ref_projection, dtype=np.float32)
        
        # Resolve reference image path relative to the project root or ai-service root
        base_dir = Path(__file__).resolve().parent.parent.parent
        self.reference_image_path = str(base_dir / reference_image_path)

# POEM_BLOCK_1
POEM_BLOCK_1 = CanonicalFixture(
    fixture_id="poem_block_1",
    expected_line_count=4,
    canonical_lines=[
        "Em yêu mùa hè",
        "Có hoa sim tím",
        "Mọc trên đồi quê",
        "Rung rinh bướm lượn."
    ],
    ref_aspect_ratio=4.338983050847458,
    ref_ink_density=0.9116045418432204,
    ref_phash=3096264036131139,
    ref_projection=[0.781, 0.712, 0.716, 0.739, 0.818] * 20,
    reference_image_path="tests/fixtures/real_hw/REAL-HW-01.jpg"
)

# POEM_BLOCK_2
POEM_BLOCK_2 = CanonicalFixture(
    fixture_id="poem_block_2",
    expected_line_count=4,
    canonical_lines=[
        "Thong thả dắt trâu",
        "Trong chiều nắng xế",
        "Em hái sim ăn",
        "Trời, sao ngọt thế!"
    ],
    ref_aspect_ratio=0.44609297725024727,
    ref_ink_density=0.503439987191887,
    ref_phash=7638714209165783669,
    ref_projection=[0.929, 0.917, 0.553, 0.0, 0.010] * 20,
    reference_image_path="tests/fixtures/real_hw/REAL-HW-02.jpg"
)

# POEM_BLOCK_3
POEM_BLOCK_3 = CanonicalFixture(
    fixture_id="poem_block_3",
    expected_line_count=4,
    canonical_lines=[
        "Gió mát lưng đồi",
        "Ve ngân ra rả",
        "Trên cao lưng đồi",
        "Diều ai vừa thả."
    ],
    ref_aspect_ratio=0.44609297725024727,
    ref_ink_density=0.5335324731720477,
    ref_phash=7638106067531988992,
    ref_projection=[0.927, 0.915, 0.552, 0.0, 0.0] * 20,
    reference_image_path="tests/fixtures/real_hw/REAL-HW-03.jpg"
)

CANONICAL_FIXTURES = [POEM_BLOCK_1, POEM_BLOCK_2, POEM_BLOCK_3]
