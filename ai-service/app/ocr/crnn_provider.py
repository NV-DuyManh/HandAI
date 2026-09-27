"""
CRNN OCR Provider for Vietnamese Handwriting.
Consumes CRNN+CTC model checkpoint and vocabulary.
Memory-safe micro-batching and CPU/CUDA inference.
"""
from typing import List, Union, Optional, Dict, Any, Tuple
from pathlib import Path
import os
import json
import logging
import threading
import re
from collections import defaultdict

import numpy as np
import torch
from torchvision import transforms
from PIL import Image

from app.ocr.provider import OcrProvider
from app.ocr.model import CRNN

logger = logging.getLogger(__name__)

IMG_H = 64
IMG_W = 1024
BLANK_IDX = 0

_TRANSFORM = transforms.Compose([
    transforms.Resize((IMG_H, IMG_W)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])


class CrnnOcrProvider(OcrProvider):
    """
    Production-grade adapter for the CRNN Vietnamese handwriting OCR engine.
    """

    def __init__(
        self,
        model_dir: Optional[Union[str, Path]] = None,
        device: Optional[Union[str, torch.device]] = None,
    ):
        if model_dir is None:
            # Default to services/ai-service/models/ocr/crnn_vi_handwriting_v1
            base_dir = Path(__file__).resolve().parent.parent.parent
            model_dir = base_dir / "models" / "ocr" / "crnn_vi_handwriting_v1"

        self.model_dir = Path(model_dir)
        self.weights_path = self.model_dir / "best_cer.pth"
        self.vocab_path = self.model_dir / "vocab.json"
        self.manifest_path = self.model_dir / "model_manifest.json"

        # Determine inference device (default: CPU for predictable memory & background execution)
        if device is not None:
            self.device = torch.device(device)
        else:
            env_dev = os.environ.get("OCR_DEVICE")
            if env_dev:
                self.device = torch.device(env_dev)
            else:
                self.device = torch.device("cpu")

        self._model: Optional[CRNN] = None
        self._vocab: Optional[Dict[str, int]] = None
        self._inv_vocab: Optional[Dict[int, str]] = None
        self._manifest: Optional[Dict[str, Any]] = None
        self._lock = threading.Lock()
        self.model_forward_call_count: int = 0
        self.last_batch_shapes: List[Tuple[int, ...]] = []

    def reset_forward_counters(self):
        self.model_forward_call_count = 0
        self.last_batch_shapes = []

    def _forward(self, x: torch.Tensor) -> torch.Tensor:
        self.model_forward_call_count += 1
        self.last_batch_shapes.append(tuple(x.shape))
        return self._model(x)

    def _ensure_loaded(self):
        """Lazy load model weights and vocabulary safely with threading lock."""
        if self._model is not None:
            return

        with self._lock:
            if self._model is not None:
                return

            if not self.weights_path.is_file():
                raise FileNotFoundError(f"OCR checkpoint not found: {self.weights_path}")
            if not self.vocab_path.is_file():
                raise FileNotFoundError(f"OCR vocab file not found: {self.vocab_path}")

            with open(self.vocab_path, "r", encoding="utf-8") as f:
                self._vocab = json.load(f)

            self._inv_vocab = {int(v): k for k, v in self._vocab.items()}

            if self.manifest_path.is_file():
                try:
                    with open(self.manifest_path, "r", encoding="utf-8") as f:
                        self._manifest = json.load(f)
                except Exception as e:
                    logger.warning(f"Could not load OCR manifest: {e}")

            model = CRNN(len(self._vocab), dropout=0.2).to(self.device)
            state = torch.load(self.weights_path, map_location=self.device, weights_only=True)
            model.load_state_dict(state)
            model.eval()
            self._model = model
            logger.info(
                f"CrnnOcrProvider loaded successfully on {self.device} "
                f"(vocab: {len(self._vocab)}, params: {sum(p.numel() for p in model.parameters()):,})"
            )

    def is_available(self) -> bool:
        return self.weights_path.is_file() and self.vocab_path.is_file()

    def get_metadata(self) -> Dict[str, Any]:
        if self._manifest is None and self.manifest_path.is_file():
            try:
                with open(self.manifest_path, "r", encoding="utf-8") as f:
                    self._manifest = json.load(f)
            except Exception as e:
                logger.warning(f"Could not load OCR manifest: {e}")
        if self._manifest:
            return self._manifest
        return {
            "model_name": "Vietnamese-Handwriting-OCR-Full",
            "model_dir": str(self.model_dir),
            "weights_path": str(self.weights_path),
            "vocab_path": str(self.vocab_path),
            "device": str(self.device),
            "is_available": self.is_available(),
        }

    def _decode_ctc_beam_search(
        self,
        probs: np.ndarray,
        beam_width: int = 15,
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        General CTC beam search decoder preserving top-K candidate sequences,
        normalized log probabilities, and candidate margins.
        """
        T, C = probs.shape
        beams = {(): (1.0, 0.0)}
        blank_idx = BLANK_IDX

        for t in range(T):
            p_t = probs[t]
            cand_indices = np.where(p_t > 1e-4)[0]
            if len(cand_indices) == 0:
                cand_indices = np.argsort(p_t)[-10:]

            next_beams = defaultdict(lambda: (0.0, 0.0))
            p_blank = float(p_t[blank_idx])

            for prefix, (p_b, p_nb) in beams.items():
                p_total = p_b + p_nb
                if p_total <= 0.0:
                    continue
                if p_blank > 1e-6:
                    curr_b, curr_nb = next_beams[prefix]
                    next_beams[prefix] = (curr_b + p_total * p_blank, curr_nb)

                for c in cand_indices:
                    if c == blank_idx:
                        continue
                    p_c = float(p_t[c])
                    last_c = prefix[-1] if prefix else None
                    if c == last_c:
                        new_prefix = prefix + (c,)
                        curr_b, curr_nb = next_beams[new_prefix]
                        next_beams[new_prefix] = (curr_b, curr_nb + p_b * p_c)
                        curr_b, curr_nb = next_beams[prefix]
                        next_beams[prefix] = (curr_b, curr_nb + p_nb * p_c)
                    else:
                        new_prefix = prefix + (c,)
                        curr_b, curr_nb = next_beams[new_prefix]
                        next_beams[new_prefix] = (curr_b, curr_nb + p_total * p_c)

            sorted_prefixes = sorted(
                next_beams.keys(),
                key=lambda pref: next_beams[pref][0] + next_beams[pref][1],
                reverse=True
            )[:beam_width]
            beams = {p: next_beams[p] for p in sorted_prefixes}

        candidates = []
        for prefix, (p_b, p_nb) in beams.items():
            total_p = p_b + p_nb
            text = "".join(self._inv_vocab.get(idx, "?") for idx in prefix)
            log_p = float(np.log(max(1e-30, total_p)))
            length = max(1, len(text))
            norm_score = float(np.exp(log_p / length))
            candidates.append({"text": text, "logProb": round(log_p, 4), "normalizedScore": round(norm_score, 4)})

        candidates.sort(key=lambda x: x["logProb"], reverse=True)
        return candidates[:top_k]

    def _decode_logits_with_uncertainty(self, logits: torch.Tensor) -> List[Tuple[str, Dict[str, Any]]]:
        """
        CTC decode with mathematically grounded sequence confidence, uncertainty features,
        character-level visual evidence, and beam-search top-k hypotheses:
        - rawCrnnConfidence: arithmetic mean of emitted non-blank character probabilities
        - minTokenConfidence: minimum non-blank emitted token probability
        - p10TokenConfidence: 10th percentile token probability
        - meanTokenConfidence: same as rawCrnnConfidence
        - blankRatio: fraction of timesteps predicted as CTC blank
        - meanEntropy: average Shannon entropy over timesteps: - sum(p * ln(p))
        - lowConfidenceTokenCount: count of emitted characters with probability < 0.50
        - sequenceLength: number of decoded characters
        - charVisualEvidence: character-level emission probabilities, alternative characters, margins, timesteps
        - topCandidates: top candidate hypotheses from CTC beam search
        - candidateMargin: normalized margin between top-1 and top-2 candidate sequences
        """
        probs = torch.softmax(logits, dim=-1).cpu().numpy()
        preds = logits.argmax(2).cpu().numpy()
        results: List[Tuple[str, Dict[str, Any]]] = []

        for b in range(preds.shape[0]):
            out = []
            char_probs = []
            char_margins = []
            char_evidence = []
            prev = -1
            current_char_prob = 0.0
            current_margin = 1.0
            current_alt_char = ""
            current_alt_prob = 0.0
            current_peak_t = 0

            for t, idx in enumerate(preds[b, :]):
                token_p = float(probs[b, t, idx])
                top2_indices = np.argsort(probs[b, t])[-2:]
                top_idx = top2_indices[1]
                alt_idx = top2_indices[0]
                margin = float(probs[b, t, top_idx] - probs[b, t, alt_idx])
                alt_char = self._inv_vocab.get(int(alt_idx), "") if alt_idx != BLANK_IDX else "BLANK"

                if idx != BLANK_IDX:
                    if idx != prev:
                        if prev != -1 and prev != BLANK_IDX and len(out) > 0:
                            char_probs.append(current_char_prob)
                            char_margins.append(current_margin)
                            char_evidence.append({
                                "char": out[-1],
                                "prob": round(current_char_prob, 4),
                                "altChar": current_alt_char,
                                "altProb": round(current_alt_prob, 4),
                                "margin": round(current_margin, 4),
                                "timestep": current_peak_t
                            })
                        emitted_char = self._inv_vocab.get(int(idx), "?")
                        out.append(emitted_char)
                        current_char_prob = token_p
                        current_margin = margin
                        current_alt_char = alt_char
                        current_alt_prob = float(probs[b, t, alt_idx])
                        current_peak_t = t
                    else:
                        if token_p > current_char_prob:
                            current_char_prob = token_p
                            current_margin = margin
                            current_alt_char = alt_char
                            current_alt_prob = float(probs[b, t, alt_idx])
                            current_peak_t = t
                else:
                    if prev != -1 and prev != BLANK_IDX and len(out) > 0:
                        char_probs.append(current_char_prob)
                        char_margins.append(current_margin)
                        char_evidence.append({
                            "char": out[-1],
                            "prob": round(current_char_prob, 4),
                            "altChar": current_alt_char,
                            "altProb": round(current_alt_prob, 4),
                            "margin": round(current_margin, 4),
                            "timestep": current_peak_t
                        })
                    current_char_prob = 0.0
                    current_margin = 1.0
                    current_alt_char = ""
                    current_alt_prob = 0.0
                prev = idx

            if prev != -1 and prev != BLANK_IDX and current_char_prob > 0.0 and len(out) > 0:
                char_probs.append(current_char_prob)
                char_margins.append(current_margin)
                char_evidence.append({
                    "char": out[-1],
                    "prob": round(current_char_prob, 4),
                    "altChar": current_alt_char,
                    "altProb": round(current_alt_prob, 4),
                    "margin": round(current_margin, 4),
                    "timestep": current_peak_t
                })

            text = "".join(out)
            t_total = max(1, preds.shape[1])
            blank_ratio = float(np.sum(preds[b, :] == BLANK_IDX) / t_total)

            # Shannon entropy: - sum(p * ln(p + 1e-12))
            entropy_per_timestep = -np.sum(probs[b] * np.log(probs[b] + 1e-12), axis=-1)
            mean_entropy = float(np.mean(entropy_per_timestep))

            if not char_probs:
                raw_conf = 0.0
                min_conf = 0.0
                p10_conf = 0.0
                low_conf_count = 0
                decoder_anomaly = False
                token_anomaly = False
            else:
                raw_conf = float(np.mean(char_probs))
                min_conf = float(np.min(char_probs))
                p10_conf = float(np.percentile(char_probs, 10))
                low_conf_count = int(sum(1 for p in char_probs if p < 0.50))
                # Generic OCR anomaly signals:
                # 1. Decoder ambiguity: any emitted character with top1 prob < 0.50 and top1-top2 margin < 0.15
                decoder_anomaly = bool(any(p < 0.50 and m < 0.15 for p, m in zip(char_probs, char_margins)))
                # 2. Disagreement anomaly: high average confidence masking a weak token with large spread (>= 0.40)
                disagreement_anomaly = bool(raw_conf >= 0.82 and min_conf < 0.50 and (raw_conf - min_conf >= 0.40))
                # 3. Replacement / repetition anomaly
                replacement_anomaly = bool(re.search(r"[\?]", text) or re.search(r"(.)\1{3,}", text))
                token_anomaly = bool(decoder_anomaly or disagreement_anomaly or replacement_anomaly)

            # CTC Beam Search top-K candidates
            candidates = self._decode_ctc_beam_search(probs[b], beam_width=15, top_k=5)
            cand_margin = 0.0
            if len(candidates) >= 2:
                cand_margin = max(0.0, candidates[0]["normalizedScore"] - candidates[1]["normalizedScore"])

            uncertainty_data = {
                "rawCrnnConfidence": round(raw_conf, 4),
                "minTokenConfidence": round(min_conf, 4),
                "p10TokenConfidence": round(p10_conf, 4),
                "meanTokenConfidence": round(raw_conf, 4),
                "blankRatio": round(blank_ratio, 4),
                "meanEntropy": round(mean_entropy, 4),
                "lowConfidenceTokenCount": low_conf_count,
                "sequenceLength": len(text),
                "decoderAnomalyDetected": decoder_anomaly,
                "tokenAnomalyDetected": token_anomaly,
                "charVisualEvidence": char_evidence,
                "topCandidates": candidates,
                "candidateMargin": round(cand_margin, 4),
            }
            results.append((text, uncertainty_data))

        return results

    def _decode_logits_with_confidence(self, logits: torch.Tensor) -> List[Tuple[str, float]]:
        """
        Greedy CTC decode with sequence confidence.
        """
        uncertainty_results = self._decode_logits_with_uncertainty(logits)
        return [(text, u["rawCrnnConfidence"]) for text, u in uncertainty_results]

    def _decode_logits(self, logits: torch.Tensor) -> List[str]:
        """Greedy CTC decode [B, T, C]."""
        decoded = self._decode_logits_with_confidence(logits)
        return [text for text, _ in decoded]

    def _prepare_image(self, image: Union[str, Path, Image.Image, np.ndarray]) -> Image.Image:
        if isinstance(image, (str, Path)):
            p = Path(image)
            if not p.is_file():
                raise FileNotFoundError(f"Image not found: {p}")
            return Image.open(str(p)).convert("RGB")
        elif isinstance(image, Image.Image):
            return image.convert("RGB")
        elif isinstance(image, np.ndarray):
            if len(image.shape) == 2:
                return Image.fromarray(image).convert("RGB")
            elif len(image.shape) == 3:
                if image.shape[2] == 3:
                    import cv2
                    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                    return Image.fromarray(rgb).convert("RGB")
                return Image.fromarray(image).convert("RGB")
            else:
                return Image.fromarray(image).convert("RGB")
        else:
            raise TypeError(f"Expected str, Path, np.ndarray or PIL.Image.Image, got {type(image)}")


    @torch.no_grad()
    def recognize_line(self, image: Union[str, Path, Image.Image]) -> str:
        """
        Recognize text in a single line image crop.
        """
        return self.recognize_line_with_confidence(image)[0]

    @torch.no_grad()
    def recognize_line_with_confidence(self, image: Union[str, Path, Image.Image, np.ndarray]) -> Tuple[str, float]:
        """
        Recognize text in a single line image crop with sequence confidence.
        """
        self._ensure_loaded()
        pil_img = self._prepare_image(image)
        x = _TRANSFORM(pil_img).unsqueeze(0).to(self.device)
        logits = self._forward(x)
        res = self._decode_logits_with_confidence(logits)[0]
        del x, logits
        return res

    @torch.no_grad()
    def recognize_line_with_uncertainty(self, image: Union[str, Path, Image.Image, np.ndarray]) -> Tuple[str, Dict[str, Any]]:
        """
        Recognize text in a single line image crop with detailed uncertainty metrics.
        """
        self._ensure_loaded()
        pil_img = self._prepare_image(image)
        x = _TRANSFORM(pil_img).unsqueeze(0).to(self.device)
        logits = self._forward(x)
        res = self._decode_logits_with_uncertainty(logits)[0]
        del x, logits
        return res

    @torch.no_grad()
    def recognize_batch(
        self,
        images: List[Union[str, Path, Image.Image]],
        batch_size: int = 4,
    ) -> List[str]:
        """
        Recognize text in a batch of line image crops using memory-safe micro-batching.
        """
        return [text for text, _ in self.recognize_batch_with_confidence(images, batch_size=batch_size)]

    @torch.no_grad()
    def recognize_batch_with_confidence(
        self,
        images: List[Union[str, Path, Image.Image]],
        batch_size: int = 4,
    ) -> List[Tuple[str, float]]:
        """
        Recognize text in a batch of line image crops with sequence confidence.
        """
        self._ensure_loaded()
        if not images:
            return []

        if batch_size < 1:
            raise ValueError(f"batch_size must be >= 1, got {batch_size}")

        results: List[Tuple[str, float]] = []
        total = len(images)

        for start_idx in range(0, total, batch_size):
            chunk = images[start_idx : start_idx + batch_size]
            tensors = []
            for item in chunk:
                pil_img = self._prepare_image(item)
                tensors.append(_TRANSFORM(pil_img))

            chunk_x = torch.stack(tensors, dim=0).to(self.device)
            chunk_logits = self._forward(chunk_x)
            chunk_results = self._decode_logits_with_confidence(chunk_logits)
            results.extend(chunk_results)

            # Release tensor references immediately
            del chunk_x
            del chunk_logits

        return results


    @torch.no_grad()
    def recognize_batch_with_uncertainty(
        self,
        images: List[Union[str, Path, Image.Image, np.ndarray]],
        batch_size: int = 4,
    ) -> List[Tuple[str, Dict[str, Any]]]:
        """
        Recognize text in a batch of line image crops with detailed uncertainty metrics.
        """
        self._ensure_loaded()
        if not images:
            return []

        if batch_size < 1:
            raise ValueError(f"batch_size must be >= 1, got {batch_size}")

        results: List[Tuple[str, Dict[str, Any]]] = []
        total = len(images)

        for start_idx in range(0, total, batch_size):
            chunk = images[start_idx : start_idx + batch_size]
            tensors = []
            for item in chunk:
                pil_img = self._prepare_image(item)
                tensors.append(_TRANSFORM(pil_img))

            chunk_x = torch.stack(tensors, dim=0).to(self.device)
            chunk_logits = self._forward(chunk_x)
            chunk_results = self._decode_logits_with_uncertainty(chunk_logits)
            results.extend(chunk_results)

            del chunk_x
            del chunk_logits

        return results
