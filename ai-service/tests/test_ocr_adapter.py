"""
Unit tests for OCR Runtime Adapter (INT.1).
Tests model architecture, provider contracts, factory resolution, micro-batching, and parity.
"""
import pytest
from pathlib import Path
from PIL import Image
import torch

from app.ocr.model import CRNN
from app.ocr.provider import OcrProvider
from app.ocr.crnn_provider import CrnnOcrProvider
from app.ocr.noop_provider import NoopOcrProvider
from app.ocr.factory import get_ocr_provider, clear_provider_cache


_ROOT = Path(__file__).resolve().parents[3]
SAMPLES_DIR = next((_ROOT / p for p in [
    "ai/handoff/staging/ocr_engine_handoff_final/ocr_engine/samples",
    "ai-training/handoff/staging/ocr_engine_handoff_final/ocr_engine/samples",
] if (_ROOT / p).exists()), _ROOT / "ai/handoff/staging/ocr_engine_handoff_final/ocr_engine/samples")
EXPECTED_PARAM_COUNT = 5962560
EXPECTED_VOCAB_SIZE = 320


def test_crnn_architecture_params_and_shapes():
    """Verify PyTorch model parameter count and output dimensions."""
    model = CRNN(num_classes=EXPECTED_VOCAB_SIZE, dropout=0.2)
    total_params = sum(p.numel() for p in model.parameters())
    assert total_params == EXPECTED_PARAM_COUNT, f"Expected {EXPECTED_PARAM_COUNT}, got {total_params}"

    # Forward pass on dummy batch
    dummy_x = torch.zeros(2, 3, 64, 1024)
    out = model(dummy_x)
    # Output should have shape [batch, timesteps=128, num_classes=320]
    assert out.shape == (2, 128, EXPECTED_VOCAB_SIZE)


def test_crnn_provider_availability_and_metadata():
    """Verify CRNN provider reports availability and valid manifest metadata."""
    provider = CrnnOcrProvider(device="cpu")
    assert provider.is_available() is True
    meta = provider.get_metadata()
    assert meta["model_name"] == "Vietnamese-Handwriting-OCR-Full"
    assert meta["artifact_sha256"] == "a807eaa763a4471bc057b9545a3521612423214858d50b1ef42b7baf28de0941"
    assert meta["num_parameters"] == EXPECTED_PARAM_COUNT
    assert meta["num_classes"] == EXPECTED_VOCAB_SIZE


def test_crnn_provider_lazy_loading_and_singleton():
    """Verify weights and vocab are lazy-loaded once and reused across calls."""
    provider = CrnnOcrProvider(device="cpu")
    assert provider._model is None
    assert provider._vocab is None

    sample_img = SAMPLES_DIR / "sample_01.jpg"
    if sample_img.is_file():
        res1 = provider.recognize_line(sample_img)
        assert isinstance(res1, str)
        model_instance = provider._model
        assert model_instance is not None

        # Call again, verify identical model instance is reused
        res2 = provider.recognize_line(sample_img)
        assert res1 == res2
        assert provider._model is model_instance


def test_crnn_provider_single_line_inference():
    """Verify single line inference on PIL Image and path string."""
    provider = CrnnOcrProvider(device="cpu")
    sample_img = SAMPLES_DIR / "sample_01.jpg"
    if not sample_img.is_file():
        pytest.skip("Staged sample image not available")

    # Predict via path
    pred_path = provider.recognize_line(str(sample_img))
    assert len(pred_path) > 0
    assert "quạt" in pred_path

    # Predict via PIL Image instance
    with Image.open(sample_img) as pil_im:
        pred_pil = provider.recognize_line(pil_im)
    assert pred_pil == pred_path


def test_crnn_provider_micro_batch_inference():
    """Verify micro-batching inference preserves order and handles chunks."""
    provider = CrnnOcrProvider(device="cpu")
    sample_01 = SAMPLES_DIR / "sample_01.jpg"
    sample_03 = SAMPLES_DIR / "sample_03.jpg"
    sample_04 = SAMPLES_DIR / "sample_04.jpg"

    if not (sample_01.is_file() and sample_03.is_file() and sample_04.is_file()):
        pytest.skip("Staged sample images not available")

    images = [sample_01, sample_03, sample_04, sample_01, sample_03]
    # Test with batch_size=2 (produces chunks: [2, 2, 1])
    batch_results = provider.recognize_batch(images, batch_size=2)
    assert len(batch_results) == 5
    assert batch_results[0] == batch_results[3]
    assert batch_results[1] == batch_results[4]


def test_crnn_provider_empty_batch_and_invalid_inputs():
    """Verify edge cases: empty batch, invalid file path, invalid type, invalid batch_size."""
    provider = CrnnOcrProvider(device="cpu")
    assert provider.recognize_batch([]) == []

    with pytest.raises(FileNotFoundError):
        provider.recognize_line("non_existent_file_12345.jpg")

    with pytest.raises(TypeError):
        provider.recognize_line(12345)  # type: ignore

    with pytest.raises(ValueError):
        provider.recognize_batch(["some_path.jpg"], batch_size=0)


def test_noop_ocr_provider():
    """Verify NoopOcrProvider fallback behavior."""
    provider = NoopOcrProvider()
    assert provider.is_available() is True
    assert provider.recognize_line("dummy.jpg") == ""
    assert provider.recognize_batch(["dummy1.jpg", "dummy2.jpg"]) == ["", ""]
    assert provider.get_metadata()["model_name"] == "NoopOcrProvider"


def test_factory_caching_and_selection():
    """Verify factory returns safe default (noop), opt-in (crnn), rejects unknown without fallback, and manages singleton cache."""
    clear_provider_cache()

    # Safe default is noop
    p_default = get_ocr_provider()
    assert isinstance(p_default, NoopOcrProvider)

    # Explicit opt-in returns CrnnOcrProvider
    p1 = get_ocr_provider("crnn_vi_handwriting_v1")
    assert isinstance(p1, CrnnOcrProvider)

    p2 = get_ocr_provider("crnn_vi_handwriting_v1")
    assert p1 is p2  # Cached singleton

    p_noop = get_ocr_provider("noop")
    assert isinstance(p_noop, NoopOcrProvider)

    # NO silent fallback: unknown provider raises ValueError
    with pytest.raises(ValueError, match="Unsupported OCR provider"):
        get_ocr_provider("unknown_provider_xyz")

    clear_provider_cache()
    p3 = get_ocr_provider("crnn_vi_handwriting_v1")
    assert p3 is not p1  # New instance after clear


def test_standalone_vs_adapter_parity():
    """
    Verify exact character-for-character parity between the standalone
    staging predict.py implementation and our integrated CrnnOcrProvider.
    """
    sample_files = [
        "sample_01.jpg",
        "sample_03.jpg",
        "sample_04.jpg",
        "sample_08.jpg",
        "sample_09.jpg",
    ]
    all_exist = all((SAMPLES_DIR / f).is_file() for f in sample_files)
    if not all_exist:
        pytest.skip("Packaged sample images not all available")

    # Import standalone staged predict
    import sys
    staging_dir = str(SAMPLES_DIR.parent)
    if staging_dir not in sys.path:
        sys.path.insert(0, staging_dir)

    try:
        from predict import predict_text as standalone_predict
    except ImportError:
        pytest.skip("Could not import standalone predict from staging")

    provider = CrnnOcrProvider(device="cpu")
    for f in sample_files:
        path = SAMPLES_DIR / f
        standalone_res = standalone_predict(str(path), device="cpu")
        adapter_res = provider.recognize_line(path)
        assert adapter_res == standalone_res, f"Parity mismatch on {f}: '{adapter_res}' != '{standalone_res}'"
