"""
PROD.4B.2R3 — Section 5: CRNN True Batch Evidence.
Proves batch tensor shapes, actual model forward passes, and latency/throughput for N in [1, 5, 8, 12, 20].
"""
import math
import time
import pytest
import numpy as np
from app.ocr.crnn_provider import CrnnOcrProvider

def test_crnn_batch_evidence():
    provider = CrnnOcrProvider()
    if not provider.is_available():
        pytest.skip("CRNN model weights not available")

    # Generate synthetic line crop images for N testing
    dummy_crop = np.full((64, 500, 3), 255, dtype=np.uint8)

    test_ns = [1, 5, 8, 12, 20]
    batch_size = 4

    print(f"\n{'N':>4} | {'BatchSize':>9} | {'TensorShape(s)':<40} | {'ForwardPasses':>13} | {'TotalCRNNMs':>11} | {'LinesPerSec':>11}")
    print("-" * 105)

    for n in test_ns:
        images = [dummy_crop.copy() for _ in range(n)]
        provider.reset_forward_counters()
        
        t0 = time.perf_counter()
        results = provider.recognize_batch_with_confidence(images, batch_size=batch_size)
        t1 = time.perf_counter()
        
        elapsed_ms = (t1 - t0) * 1000.0
        lps = n / (t1 - t0) if (t1 - t0) > 0 else 0.0
        
        expected_passes = math.ceil(n / batch_size)
        actual_passes = provider.model_forward_call_count
        actual_shapes = provider.last_batch_shapes
        
        assert len(results) == n, f"Expected {n} results, got {len(results)}"
        assert actual_passes == expected_passes, f"Expected {expected_passes} forward passes for N={n}, got {actual_passes}"
        
        # Verify shape of each chunk
        for idx, shape in enumerate(actual_shapes):
            expected_chunk_b = min(batch_size, n - idx * batch_size)
            assert shape == (expected_chunk_b, 3, 64, 1024), f"Shape mismatch: expected ({expected_chunk_b}, 3, 64, 1024), got {shape}"
            
        shapes_str = ", ".join(f"{s[0]}x{s[1]}x{s[2]}x{s[3]}" for s in actual_shapes)
        print(f"{n:>4} | {batch_size:>9} | {shapes_str:<40} | {actual_passes:>13} | {elapsed_ms:>10.2f}ms | {lps:>11.1f}")
