"""
Tests for ImageSourceResolver — security gate and fixture/minio resolution.
"""
import pytest
from app.image.resolver import ImageSourceResolver, ImageReferenceError


# ── Fixture mode ─────────────────────────────────────────────────────────────

def test_fixture_reference_resolves_bytes():
    resolver = ImageSourceResolver(runtime_mode="FIXTURE")
    data = resolver.resolve("fixture://valid-addition")
    assert data == b"FIXTURE_IMAGE_BYTES:valid-addition"


def test_fixture_reference_rejected_in_model_mode():
    resolver = ImageSourceResolver(runtime_mode="MODEL")
    with pytest.raises(ImageReferenceError, match="FIXTURE runtime mode"):
        resolver.resolve("fixture://valid-addition")


# ── Security gate: rejected references ───────────────────────────────────────

def test_path_traversal_rejected():
    resolver = ImageSourceResolver(runtime_mode="FIXTURE")
    with pytest.raises(ImageReferenceError, match="Path traversal"):
        resolver.resolve("minio://bucket/../etc/passwd")


def test_file_scheme_rejected():
    resolver = ImageSourceResolver(runtime_mode="FIXTURE")
    with pytest.raises(ImageReferenceError, match="not allowed"):
        resolver.resolve("file:///etc/passwd")


def test_http_url_rejected():
    resolver = ImageSourceResolver(runtime_mode="FIXTURE")
    with pytest.raises(ImageReferenceError, match="Arbitrary external URLs"):
        resolver.resolve("http://evil.com/image.png")


def test_https_url_rejected():
    resolver = ImageSourceResolver(runtime_mode="FIXTURE")
    with pytest.raises(ImageReferenceError, match="Arbitrary external URLs"):
        resolver.resolve("https://evil.com/image.png")


def test_unknown_scheme_rejected():
    resolver = ImageSourceResolver(runtime_mode="FIXTURE")
    with pytest.raises(ImageReferenceError, match="Unsupported image reference scheme"):
        resolver.resolve("ftp://somehost/image.png")


# ── MinIO scheme: no client configured ───────────────────────────────────────

def test_minio_without_client_raises():
    resolver = ImageSourceResolver(runtime_mode="FIXTURE")
    with pytest.raises(ImageReferenceError, match="MinIO client is not configured"):
        resolver.resolve("minio://submissions/student1/img.jpg")


def test_minio_invalid_bucket_rejected():
    resolver = ImageSourceResolver(runtime_mode="FIXTURE")
    with pytest.raises(ImageReferenceError, match="not valid or not allowed"):
        resolver.resolve("minio://INVALID_BUCKET/key.jpg")


def test_minio_unsafe_key_rejected():
    resolver = ImageSourceResolver(runtime_mode="FIXTURE")
    with pytest.raises(ImageReferenceError, match="unsafe characters"):
        # semicolons and spaces are not in the safe pattern
        resolver.resolve("minio://submissions/key;rm -rf /")


def test_minio_malformed_path_rejected():
    resolver = ImageSourceResolver(runtime_mode="FIXTURE")
    with pytest.raises(ImageReferenceError, match="Invalid minio"):
        resolver.resolve("minio://no-slash-object")


def test_minio_resolver_fetches_bytes():
    from unittest.mock import MagicMock
    mock_client = MagicMock()
    mock_resp = MagicMock()
    mock_resp.read.return_value = b"REAL_IMAGE_BYTES"
    mock_client.get_object.return_value = mock_resp

    resolver = ImageSourceResolver(runtime_mode="FIXTURE", minio_client=mock_client)
    data = resolver.resolve("minio://mathvision/sub1/image.png")
    assert data == b"REAL_IMAGE_BYTES"
    mock_client.get_object.assert_called_once_with("mathvision", "sub1/image.png")

