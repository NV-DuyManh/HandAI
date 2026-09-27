from app.recognition.quality import QualityGate

def test_quality_gate_pass():
    gate = QualityGate()
    assert gate.evaluate("fixture://valid-addition") == "PASS"

def test_quality_gate_retake():
    gate = QualityGate()
    assert gate.evaluate("fixture://quality-dark") == "NEEDS_RETAKE"
    assert gate.evaluate("fixture://quality-blur") == "NEEDS_RETAKE"

def test_quality_gate_crop():
    gate = QualityGate()
    assert gate.evaluate("fixture://quality-incomplete-crop") == "CROP_REQUIRED"
