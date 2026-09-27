import json
import os
import hashlib
import logging
from app.schemas.model import ModelManifest

logger = logging.getLogger(__name__)

SUPPORTED_ARTIFACT_FORMATS = {"PYTORCH", "TORCHSCRIPT", "ONNX", "PADDLE"}
SUPPORTED_LABEL_MAP_VERSIONS = {"v1", "v1.0", "v1.1", "v1.2", "mathvision_det_v1.0"}


class ManifestValidationError(ValueError):
    """Raised when a manifest fails semantic validation (format, label map, etc.)."""


class ChecksumMismatchError(ValueError):
    """Raised when the artifact checksum does not match the manifest sha256."""


class ModelManifestLoader:
    def __init__(self, manifest_path: str, artifact_base_dir: str = ""):
        self.manifest_path = manifest_path
        self.artifact_base_dir = artifact_base_dir

    def load(self) -> ModelManifest:
        if not self.manifest_path or not os.path.exists(self.manifest_path):
            raise FileNotFoundError(f"Model manifest not found at '{self.manifest_path}'")

        with open(self.manifest_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        manifest = ModelManifest(**data)

        # ── Format validation ────────────────────────────────────────────────
        if manifest.artifactFormat.upper() not in SUPPORTED_ARTIFACT_FORMATS:
            raise ManifestValidationError(
                f"Unsupported artifact format '{manifest.artifactFormat}'. "
                f"Supported: {SUPPORTED_ARTIFACT_FORMATS}"
            )

        # ── Label map version validation ─────────────────────────────────────
        if manifest.labelMapVersion and manifest.labelMapVersion not in SUPPORTED_LABEL_MAP_VERSIONS:
            raise ManifestValidationError(
                f"Unknown label map version '{manifest.labelMapVersion}'. "
                f"Supported: {SUPPORTED_LABEL_MAP_VERSIONS}"
            )

        logger.info(
            f"Manifest loaded: {manifest.modelName} v{manifest.modelVersion} "
            f"format={manifest.artifactFormat}"
        )
        return manifest

    def load_and_verify_artifact(self) -> ModelManifest:
        """
        Load manifest AND verify artifact checksum.
        Raises ChecksumMismatchError if sha256 does not match.
        Raises FileNotFoundError if artifact file is missing.
        """
        manifest = self.load()

        artifact_path = os.path.join(self.artifact_base_dir, manifest.artifactFilename)
        if not os.path.exists(artifact_path):
            raise FileNotFoundError(
                f"Artifact file not found at '{artifact_path}'. "
                "Cannot verify checksum without artifact."
            )

        logger.info(f"Verifying artifact checksum for '{artifact_path}'...")
        computed = self._sha256_file(artifact_path)
        if computed.lower() != manifest.sha256.lower():
            raise ChecksumMismatchError(
                f"Artifact checksum mismatch for '{artifact_path}'. "
                f"Manifest expected: {manifest.sha256[:12]}... "
                f"Computed: {computed[:12]}..."
            )

        logger.info("Artifact checksum verified OK.")
        return manifest

    @staticmethod
    def _sha256_file(path: str) -> str:
        h = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()
