"""
ImageSourceResolver — Secure image reference resolver.

Resolves image references to bytes WITHOUT exposing arbitrary filesystem paths,
public URLs, or raw MinIO credentials to callers.

Accepted reference schemes:
  fixture://...   — fixture/test references (FIXTURE runtime mode only)
  minio://bucket/object-key — internal MinIO object key (validated against allowed bucket)

Rejected schemes:
  http://... (external host)
  file:///...
  ../../... (path traversal)
  Any unrecognised scheme
"""

import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_ALLOWED_MINIO_BUCKET_PATTERN = re.compile(r'^[a-z0-9][a-z0-9\-]{1,61}[a-z0-9]$')
_SAFE_OBJECT_KEY_PATTERN = re.compile(r'^[a-zA-Z0-9/_\-\.]+$')


class ImageReferenceError(ValueError):
    """Raised when an image reference fails security validation."""


class ImageSourceResolver:
    """
    Resolves a validated image reference to raw bytes.

    Acceptable references:
      - fixture://<tag>          → returns synthetic fixture bytes (FIXTURE mode only)
      - minio://<bucket>/<key>   → uses configured private MinIO client to fetch object bytes
    """

    def __init__(self, runtime_mode: str, minio_client=None, minio_endpoint: Optional[str] = None):
        self.runtime_mode = runtime_mode
        self._minio_client = minio_client
        self._minio_endpoint = minio_endpoint

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def resolve(self, reference: str) -> bytes:
        """
        Resolves a reference to bytes. Raises ImageReferenceError if the
        reference fails security validation.
        """
        self._reject_unsafe(reference)

        if reference.startswith("fixture://"):
            return self._resolve_fixture(reference)

        if reference.startswith("minio://"):
            return self._resolve_minio(reference)

        raise ImageReferenceError(
            f"Unsupported image reference scheme: '{reference}'. "
            "Only fixture:// and minio:// references are accepted."
        )

    # ------------------------------------------------------------------
    # Security gate
    # ------------------------------------------------------------------

    def _reject_unsafe(self, reference: str) -> None:
        """Reject known-dangerous reference patterns."""
        lowered = reference.lower()

        if "/../" in reference or reference.startswith("../"):
            raise ImageReferenceError(f"Path traversal detected in reference: '{reference}'")

        if lowered.startswith("file://") or lowered.startswith("file:///"):
            raise ImageReferenceError(f"Local filesystem references are not allowed: '{reference}'")

        if lowered.startswith("http://") or lowered.startswith("https://"):
            raise ImageReferenceError(
                f"Arbitrary external URLs are not allowed: '{reference}'. "
                "Use minio:// with a validated object key."
            )

    # ------------------------------------------------------------------
    # Fixture resolver (FIXTURE mode only)
    # ------------------------------------------------------------------

    def _resolve_fixture(self, reference: str) -> bytes:
        if self.runtime_mode != "FIXTURE":
            raise ImageReferenceError(
                "fixture:// references are only allowed in FIXTURE runtime mode."
            )
        tag = reference[len("fixture://"):]
        logger.debug(f"Resolving fixture reference tag='{tag}'")
        # Return synthetic placeholder bytes for fixture scenarios
        return f"FIXTURE_IMAGE_BYTES:{tag}".encode("utf-8")

    # ------------------------------------------------------------------
    # MinIO resolver (MODEL / FIXTURE mode)
    # ------------------------------------------------------------------

    def _resolve_minio(self, reference: str) -> bytes:
        """
        reference format: minio://<bucket>/<object-key>
        Uses configured private MinIO client. Never makes MinIO public.
        """
        path = reference[len("minio://"):]
        parts = path.split("/", 1)
        if len(parts) != 2:
            raise ImageReferenceError(
                f"Invalid minio:// reference format. Expected minio://bucket/key, got: '{reference}'"
            )
        bucket, key = parts[0], parts[1]

        if not _ALLOWED_MINIO_BUCKET_PATTERN.match(bucket):
            raise ImageReferenceError(f"Bucket name '{bucket}' is not valid or not allowed.")

        if not _SAFE_OBJECT_KEY_PATTERN.match(key):
            raise ImageReferenceError(
                f"Object key '{key}' contains unsafe characters. "
                "Only alphanumerics, /, _, -, . are allowed."
            )

        if self._minio_client is None:
            raise ImageReferenceError(
                "MinIO client is not configured. Cannot resolve minio:// reference."
            )

        logger.info(f"Fetching image from MinIO bucket='{bucket}' key='{key}'")
        try:
            response = self._minio_client.get_object(bucket, key)
            try:
                return response.read()
            finally:
                response.close()
                response.release_conn()
        except Exception as exc:
            raise ImageReferenceError(
                f"Failed to fetch object '{key}' from bucket '{bucket}': {exc}"
            ) from exc


def create_configured_resolver() -> ImageSourceResolver:
    """
    Factory creating ImageSourceResolver configured with private MinIO client
    using settings. MinIO credentials are never exposed or public.
    """
    from app.config import settings
    minio_client = None
    try:
        from minio import Minio
        endpoint = settings.minio_endpoint
        if endpoint.startswith("http://"):
            endpoint = endpoint[len("http://"):]
        elif endpoint.startswith("https://"):
            endpoint = endpoint[len("https://"):]
        minio_client = Minio(
            endpoint=endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
        )
    except Exception as e:
        logger.warning(f"Could not initialize MinIO client: {e}")

    return ImageSourceResolver(
        runtime_mode=settings.runtime_mode,
        minio_client=minio_client,
        minio_endpoint=settings.minio_endpoint,
    )

