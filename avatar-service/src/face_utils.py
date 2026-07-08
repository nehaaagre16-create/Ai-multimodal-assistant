import cv2
import numpy as np
from typing import Tuple, Optional
import mediapipe as mp
mp_face_detection = mp.solutions.face_detection


class FaceDetector:
    """MediaPipe face detector for Wav2Lip preprocessing."""

    def __init__(self, prototxt_path: str = None, model_path: str = None, confidence_threshold: float = 0.5):
        self.confidence_threshold = confidence_threshold
        self.detector = mp_face_detection.FaceDetection(
            model_selection=1,  # 0=short range, 1=full range (better for varied images)
            min_detection_confidence=self.confidence_threshold,
        )

    def detect(self, frame: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
        """Detect the largest face in a frame. Returns (x, y, w, h) or None."""
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.detector.process(rgb)
        if not results.detections:
            return None

        best_box = None
        best_area = 0.0
        h, w = frame.shape[:2]
        for detection in results.detections:
            bbox = detection.location_data.relative_bounding_box
            x1 = int(bbox.xmin * w)
            y1 = int(bbox.ymin * h)
            bw = int(bbox.width * w)
            bh = int(bbox.height * h)
            area = bw * bh
            if area > best_area:
                best_area = area
                best_box = (x1, y1, bw, bh)
        return best_box


def get_smoothed_face_box(
    detector: FaceDetector,
    frames: list,
    target_size: int = 96,
    padding: float = 0.3
) -> Tuple[Tuple[int, int, int, int], np.ndarray]:
    """
    Detect the face in each frame, smooth the box across frames, and return the
    crop box plus the resized face images ready for the Wav2Lip model.
    """
    boxes = []
    for frame in frames:
        box = detector.detect(frame)
        if box is None:
            # Fallback to center crop if no face detected
            h, w = frame.shape[:2]
            size = min(h, w)
            boxes.append(((w - size) // 2, (h - size) // 2, size, size))
        else:
            boxes.append(box)

    # Smooth boxes with moving average
    boxes = np.array(boxes, dtype=np.float32)
    smoothed = boxes.copy()
    window = 3
    for i in range(len(boxes)):
        start = max(0, i - window)
        end = min(len(boxes), i + window + 1)
        smoothed[i] = boxes[start:end].mean(axis=0)
    smoothed = smoothed.astype(int)

    face_images = []
    for i, frame in enumerate(frames):
        x, y, w, h = smoothed[i]
        # Pad to make it square-ish and include some context
        cx, cy = x + w // 2, y + h // 2
        size = int(max(w, h) * (1 + padding))
        x1 = max(0, cx - size // 2)
        y1 = max(0, cy - size // 2)
        x2 = min(frame.shape[1], x1 + size)
        y2 = min(frame.shape[0], y1 + size)
        crop = frame[y1:y2, x1:x2]
        crop_resized = cv2.resize(crop, (target_size, target_size), interpolation=cv2.INTER_AREA)
        face_images.append(crop_resized)

    return tuple(smoothed[0]) if len(smoothed) > 0 else (0, 0, 0, 0), np.array(face_images)


def paste_lip_region(
    original_frame: np.ndarray,
    generated_face: np.ndarray,
    crop_box: Tuple[int, int, int, int],
    target_size: int = 96
) -> np.ndarray:
    """Paste the generated 96x96 face back onto the original frame at the crop location."""
    x, y, w, h = crop_box
    # Resize generated face back to original crop size
    resized = cv2.resize(generated_face, (w, h), interpolation=cv2.INTER_CUBIC)
    # Blend into the original frame using a simple overlay
    output = original_frame.copy()
    y2 = min(y + h, output.shape[0])
    x2 = min(x + w, output.shape[1])
    roi_h = y2 - y
    roi_w = x2 - x
    if roi_h > 0 and roi_w > 0:
        output[y:y2, x:x2] = resized[:roi_h, :roi_w]
    return output
