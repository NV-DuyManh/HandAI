"""
UI Acceptance Suite (21 checks) for AI.HWTEXT.PROD.1
HOME-01..06, EDITOR-01..07, RESULT-01..08
"""

import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
MOBILE_ROOT = REPO_ROOT / "apps" / "student-mobile"
HOME_SCREEN_PATH = MOBILE_ROOT / "src" / "app" / "(tabs)" / "index.tsx"
EDITOR_SCREEN_PATH = MOBILE_ROOT / "src" / "app" / "ocr-pilot" / "multiline-review.tsx"
RESULT_SCREEN_PATH = MOBILE_ROOT / "src" / "app" / "ocr-pilot" / "multiline-result.tsx"
LAYOUT_PATH = MOBILE_ROOT / "src" / "app" / "(tabs)" / "_layout.tsx"


def read_file(path: Path) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


# ==============================================================================
# HOME-01..06: Home Screen Acceptance
# ==============================================================================

def test_home_01_no_thu_wording():
    """HOME-01: No 'THỬ' wording in user-facing labels on Home screen"""
    content = read_file(HOME_SCREEN_PATH)
    assert "THỬ NHẬN DIỆN 1 DÒNG" not in content
    assert "THỬ NHẬN DIỆN NHIỀU DÒNG" not in content
    assert "Thử nghiệm" not in content
    assert "Bản thử" not in content


def test_home_02_no_pilot_badges():
    """HOME-02: No 'PILOT' or 'BETA' badges in user-facing UI on Home screen"""
    content = read_file(HOME_SCREEN_PATH)
    assert "PILOT 1" not in content
    assert "PILOT 2" not in content
    assert "BETA" not in content
    assert "pilotBadge" not in content


def test_home_03_hero_camera_and_library_actions():
    """HOME-03: Hero camera + library actions clear"""
    content = read_file(HOME_SCREEN_PATH)
    assert "Đọc chữ viết tay" in content
    assert "Chụp ảnh" in content
    assert "Chọn từ thư viện" in content


def test_home_04_unified_handwriting_flow():
    """HOME-04: Unified handwriting flow - no separate 1-line vs multi-line split"""
    content = read_file(HOME_SCREEN_PATH)
    assert "Nhận diện 1 dòng" not in content
    assert "Nhận diện nhiều dòng" not in content
    assert "Đọc phép tính" in content


def test_home_05_tips_visually_secondary():
    """HOME-05: Tips visually secondary and streamlined"""
    content = read_file(HOME_SCREEN_PATH)
    assert "Mẹo chụp ảnh rõ nét" in content
    assert "Đủ ánh sáng" in content
    assert "Chụp thẳng góc" in content
    assert "Căn trọn khung hình" in content
    assert "tránh để bóng tay" in content


def test_home_06_bottom_nav_polished():
    """HOME-06: Bottom nav polished"""
    content = read_file(LAYOUT_PATH)
    assert "Trang chủ" in content
    assert "Chụp" in content
    assert "Của em" in content


# ==============================================================================
# EDITOR-01..07: Multiline Editor Acceptance
# ==============================================================================

def test_editor_01_image_boxes_usable():
    """EDITOR-01: Image canvas and boxes remain interactive and usable"""
    content = read_file(EDITOR_SCREEN_PATH)
    assert "imageContainer" in content
    assert "boxOverlay" in content
    assert "boxes.map" in content


def test_editor_02_selected_line_obvious():
    """EDITOR-02: Selected line obvious"""
    content = read_file(EDITOR_SCREEN_PATH)
    assert "Dòng đang chọn:" in content


def test_editor_03_movement_controls_understandable():
    """EDITOR-03: Movement controls understandable with arrows"""
    content = read_file(EDITOR_SCREEN_PATH)
    assert "Di chuyển" in content
    assert "arrow-up" in content
    assert "arrow-down" in content
    assert "arrow-back" in content
    assert "arrow-forward" in content


def test_editor_04_resize_controls_understandable():
    """EDITOR-04: Resize controls understandable with +/- and labels"""
    content = read_file(EDITOR_SCREEN_PATH)
    assert "− Rộng" in content
    assert "+ Rộng" in content
    assert "− Cao" in content
    assert "+ Cao" in content


def test_editor_05_add_delete_clear():
    """EDITOR-05: Add and delete actions clear"""
    content = read_file(EDITOR_SCREEN_PATH)
    assert "Thêm dòng" in content
    assert "Xóa dòng" in content


def test_editor_06_cta_says_nhan_dien_chu():
    """EDITOR-06: CTA says 'Nhận diện chữ' with ready line count support text"""
    content = read_file(EDITOR_SCREEN_PATH)
    assert "Nhận diện chữ" in content
    assert "dòng đã sẵn sàng" in content


def test_editor_07_submit_loading_disabled_state():
    """EDITOR-07: Submit loading and disabled state polished"""
    content = read_file(EDITOR_SCREEN_PATH)
    assert "Đang xử lý..." in content
    assert "disabled={requestStatus === 'SUBMITTING' || boxes.length === 0}" in content


# ==============================================================================
# RESULT-01..08: Multiline Result Acceptance
# ==============================================================================

def test_result_01_ocr_goc_separated():
    """RESULT-01: OCR gốc clearly separated"""
    content = read_file(RESULT_SCREEN_PATH)
    assert "OCR gốc" in content
    assert "sectionABox" in content
    assert "CRNN" in content


def test_result_02_goi_y_1_clean():
    """RESULT-02: Gợi ý 1 clean with button 'Dùng gợi ý 1'"""
    content = read_file(RESULT_SCREEN_PATH)
    assert "Gợi ý 1" in content
    assert "Dùng gợi ý 1" in content


def test_result_03_goi_y_2_clean():
    """RESULT-03: Gợi ý 2 clean with button 'Dùng gợi ý 2'"""
    content = read_file(RESULT_SCREEN_PATH)
    assert "Gợi ý 2" in content
    assert "Dùng gợi ý 2" in content


def test_result_04_provider_names_secondary():
    """RESULT-04: Provider names secondary using subtle chip styles"""
    content = read_file(RESULT_SCREEN_PATH)
    assert "providerChipGroq" in content
    assert "providerChipGemini" in content
    assert "providerChipCrnn" in content


def test_result_05_manual_edit_clear():
    """RESULT-05: Manual edit clear ('Tự sửa', text input and Save/Cancel)"""
    content = read_file(RESULT_SCREEN_PATH)
    assert "Tự sửa" in content
    assert "Lưu & Xác nhận" in content
    assert "Hủy" in content


def test_result_06_current_effective_selection_understandable():
    """RESULT-06: Current/effective selection understandable ('KẾT QUẢ HIỆN TẠI:')"""
    content = read_file(RESULT_SCREEN_PATH)
    assert "KẾT QUẢ HIỆN TẠI:" in content
    assert "sectionCBox" in content


def test_result_07_no_dev_panel():
    """RESULT-07: No student-facing DEV or diagnostic panel"""
    content = read_file(RESULT_SCREEN_PATH)
    assert "DevPanel" not in content
    assert "DebugPanel" not in content
    assert "DebugCard" not in content
    assert "Bảng chẩn đoán kỹ thuật (DEV)" not in content
    assert "devPanelCard" not in content
    assert "devBox" not in content


def test_result_08_unavailable_provider_state_clean():
    """RESULT-08: Unavailable provider state is clean without ugly copy (Task D)"""
    content = read_file(RESULT_SCREEN_PATH)
    assert "Gemini tạm thời chưa khả dụng." not in content
    assert "Groq tạm thời chưa khả dụng." not in content
