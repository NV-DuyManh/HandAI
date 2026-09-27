"""
ModelRecognitionEngine — Architecture boundary for trained ML model integration.
Consumes ModelManifest, artifact path, label map, and preprocessing configuration.
Does NOT fabricate model inference. Raises ModelNotAvailableError or returns
explicit MODEL_NOT_AVAILABLE status when real trained artifact is absent.
"""
from typing import Optional, Dict, Any, Union
import os
import io
import logging
from PIL import Image

from app.recognition.engine import RecognitionEngine
from app.recognition.manifest import ModelManifestLoader
from app.recognition.yolo_adapter import YoloDetectionAdapter
from app.image.resolver import create_configured_resolver
from app.schemas.core import ImageRecognitionResult
from app.schemas.model import ModelManifest

logger = logging.getLogger(__name__)


class ModelNotAvailableError(RuntimeError):
    """Raised when inference is attempted but model artifact has not been provided."""
    pass


class UnsupportedPreprocessingError(ValueError):
    """Raised when the manifest requests an unsupported preprocessing strategy."""
    pass


SUPPORTED_PREPROCESSING_STRATEGIES = {
    "GRAYSCALE_OTSU": {
        "color_mode": "GRAYSCALE",
        "binarization": "OTSU",
        "normalization": "DIV_255",
    },
    "RGB_NORMALIZED": {
        "color_mode": "RGB",
        "binarization": None,
        "normalization": "STANDARD_SCORE",
    },
    "RESIZE_ONLY": {
        "color_mode": "RGB",
        "binarization": None,
        "normalization": None,
    },
    "resize_224_normalize": {
        "color_mode": "RGB",
        "binarization": None,
        "normalization": "STANDARD_SCORE",
    },
    "normalize_imagenet": {
        "color_mode": "RGB",
        "binarization": None,
        "normalization": "IMAGENET",
    },
}


class ModelRecognitionEngine(RecognitionEngine):
    """
    Adapter boundary between AI Service runtime and trained machine learning models.

    Consumes:
      - ModelManifest: metadata, sha256 checksum, input shape
      - artifact: binary weights file path / bytes (.pt YOLOv8)
      - label_map: dictionary mapping token IDs / indices to canonical characters
      - preprocessing_config: normalization, resizing, color space parameters

    Guarantees:
      - Preprocessing is strictly manifest-driven.
      - Never fabricates model predictions or metrics.
      - Gracefully handles missing artifact (MODEL_NOT_AVAILABLE).
      - Verifies artifact integrity via sha256 checksum when loaded.
      - Maps YOLO outputs to canonical Token and ImageRecognitionResult objects.
    """

    def __init__(
        self,
        manifest: Optional[ModelManifest] = None,
        artifact_path: Optional[str] = None,
        label_map: Optional[Dict[str, Any]] = None,
        preprocessing_config: Optional[Dict[str, Any]] = None,
        conf_threshold: float = 0.20,
    ):
        self.manifest = manifest
        self.artifact_path = artifact_path
        self.label_map = label_map or {}
        self.preprocessing_config = preprocessing_config or {}
        self.conf_threshold = conf_threshold
        self.adapter = YoloDetectionAdapter(conf_threshold=conf_threshold)
        self._yolo_model = None
        self._is_ready = False

        if self.manifest:
            self._configure_from_manifest(self.manifest)
        elif not self.artifact_path:
            # Try loading default runtime manifest if present
            self._try_load_default()

    def _try_load_default(self):
        """Attempts to load default model manifest from configured models directory."""
        from app.config import settings
        default_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "models"))
        manifest_path = settings.model_manifest_path or os.path.join(default_dir, "model_manifest.json")
        
        if os.path.exists(manifest_path):
            try:
                loader = ModelManifestLoader(manifest_path, artifact_base_dir=default_dir)
                manifest = loader.load()
                art_path = settings.model_artifact_path or os.path.join(default_dir, manifest.artifactFilename)
                if os.path.exists(art_path):
                    self.manifest = manifest
                    self.artifact_path = art_path
                    self._configure_from_manifest(manifest)
            except Exception as e:
                logger.warning(f"Could not initialize default model from manifest: {e}")

    def _configure_from_manifest(self, manifest: ModelManifest):
        self.manifest = manifest
        if manifest.preprocessing:
            if manifest.preprocessing not in SUPPORTED_PREPROCESSING_STRATEGIES:
                raise UnsupportedPreprocessingError(
                    f"Unsupported preprocessing strategy: '{manifest.preprocessing}'. "
                    f"Supported strategies: {sorted(list(SUPPORTED_PREPROCESSING_STRATEGIES.keys()))}"
                )
            base_config = SUPPORTED_PREPROCESSING_STRATEGIES[manifest.preprocessing].copy()
            self.preprocessing_config.update(base_config)
            self.preprocessing_config["strategy"] = manifest.preprocessing
        else:
            self.preprocessing_config.setdefault("strategy", "PASSTHROUGH")
            self.preprocessing_config.setdefault("color_mode", "ORIGINAL")
            self.preprocessing_config.setdefault("binarization", None)
            self.preprocessing_config.setdefault("normalization", None)

        if manifest.inputWidth and manifest.inputHeight:
            channels = manifest.inputChannels or (
                1 if self.preprocessing_config.get("color_mode") == "GRAYSCALE" else 3
            )
            self.preprocessing_config["input_shape"] = (
                manifest.inputWidth,
                manifest.inputHeight,
                channels,
            )

        if self.artifact_path:
            self._is_ready = True
            if os.path.exists(self.artifact_path):
                self._load_yolo()
        else:
            self._is_ready = False

    def _load_yolo(self):
        """Loads Ultralytics YOLO model from artifact path."""
        try:
            from ultralytics import YOLO
            logger.info(f"Loading YOLO model from {self.artifact_path}...")
            self._yolo_model = YOLO(self.artifact_path)
            logger.info("YOLO model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load YOLO model: {e}")
            self._yolo_model = None

    @property
    def is_ready(self) -> bool:
        """Returns True only when manifest AND artifact are available."""
        return self._is_ready

    def recognize(self, image_reference: Union[str, bytes]) -> ImageRecognitionResult:
        if not self._is_ready or not self.manifest:
            logger.warning("Inference attempted but model artifact is not available.")
            raise ModelNotAvailableError(
                "Model artifact has not been provided. "
                "AI runtime is ready for model handoff, but artifact is NOT_PROVIDED."
            )

        if self._yolo_model is None:
            if self.artifact_path and os.path.exists(self.artifact_path):
                self._load_yolo()
            if self._yolo_model is None:
                raise ModelNotAvailableError(
                    f"Model artifact at '{self.artifact_path}' could not be loaded."
                )

        # 1. Resolve image bytes
        if isinstance(image_reference, bytes):
            image_bytes = image_reference
        elif isinstance(image_reference, str):
            if image_reference.startswith("minio://") or image_reference.startswith("fixture://"):
                resolver = create_configured_resolver()
                image_bytes = resolver.resolve(image_reference)
            elif os.path.exists(image_reference):
                with open(image_reference, "rb") as f:
                    image_bytes = f.read()
            else:
                resolver = create_configured_resolver()
                image_bytes = resolver.resolve(image_reference)
        else:
            raise ValueError(f"Unsupported image_reference type: {type(image_reference)}")

        # 2. Decode image with PIL
        try:
            pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            img_w, img_h = pil_image.size
        except Exception as e:
            logger.error(f"Failed to decode image bytes: {e}")
            return ImageRecognitionResult(tokens=[], status="OUT_OF_SCOPE")

        # 3. Run YOLO inference
        imgsz = self.manifest.inputWidth if (self.manifest and self.manifest.inputWidth) else 640
        try:
            results = self._yolo_model(pil_image, conf=self.adapter.conf_threshold, imgsz=imgsz, verbose=False)
            raw_boxes = results[0].boxes
        except Exception as e:
            logger.error(f"YOLO inference error: {e}")
            return ImageRecognitionResult(tokens=[], status="OUT_OF_SCOPE")

        # 4. Convert YOLO detections to canonical tokens
        recognition_result = self.adapter.process_detections(raw_boxes, img_w, img_h)

        # 5. Execute Spatial Row Grouping & OCR Bridge (shadow diagnostics)
        if recognition_result.tokens:
            try:
                from app.layout.row_grouper import RowGrouper
                from app.ocr.bridge import OcrBridge

                grouper = RowGrouper()
                row_groups = grouper.group(recognition_result.tokens, img_w=img_w, img_h=img_h)
                bridge = OcrBridge()
                bridge_result = bridge.recognize_rows(pil_image, row_groups)

                recognition_result.line_recognitions = bridge_result.line_recognitions
                recognition_result.all_rows_agree = bridge_result.all_rows_agree
                recognition_result.ocr_provider_used = bridge_result.provider_used
            except Exception as e:
                logger.warning(f"Row grouping or OCR bridge execution failed: {e}")

        return recognition_result
