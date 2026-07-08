import os
import cv2
import numpy as np
import onnxruntime as ort
from typing import Tuple, Optional

try:
    from .face_utils import FaceDetector, get_smoothed_face_box, paste_lip_region
    from .audio_utils import wav2lip_mel_chunks, load_audio
except ImportError:
    from face_utils import FaceDetector, get_smoothed_face_box, paste_lip_region
    from audio_utils import wav2lip_mel_chunks, load_audio


class Wav2LipInference:
    """CPU-only Wav2Lip ONNX inference pipeline."""

    def __init__(
        self,
        model_path: str,
        face_detector_proto: str = None,
        face_detector_model: str = None,
        providers: Optional[list] = None,
    ):
        self.model_path = model_path
        self.face_detector_proto = face_detector_proto
        self.face_detector_model = face_detector_model
        self.providers = providers or ["CPUExecutionProvider"]
        self.session = None
        self.detector = None
        self._init_session()
        self._init_detector()

    def _init_session(self):
        self.session = ort.InferenceSession(self.model_path, providers=self.providers)

    def _init_detector(self):
        self.detector = FaceDetector(self.face_detector_proto, self.face_detector_model)

    def _preprocess_video_frames(
        self, video_path: str, audio_path: str
    ) -> Tuple[list, np.ndarray, Tuple[int, int, int, int], float]:
        """Load video frames, loop/trim to match audio length, and detect/align face."""
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        raw_frames = []
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            raw_frames.append(frame)
        cap.release()

        if not raw_frames:
            raise ValueError(f"No frames read from video: {video_path}")

        # Load audio to determine target duration
        wav, sr = load_audio(audio_path, sr=16000)
        audio_duration = len(wav) / sr
        target_frames = int(audio_duration * fps)

        # Loop source video to match audio duration
        frames = [raw_frames[i % len(raw_frames)] for i in range(target_frames)]

        crop_box, face_images = get_smoothed_face_box(self.detector, frames, target_size=96)
        # Normalize face images to [0, 1] and transpose to (T, 3, 96, 96)
        face_images = face_images.astype(np.float32) / 255.0
        face_images = np.transpose(face_images, (0, 3, 1, 2))
        return frames, face_images, tuple(crop_box), fps

    def _run_inference(self, face_images: np.ndarray, mel_chunks: np.ndarray) -> np.ndarray:
        """
        Run Wav2Lip sliding window inference.
        face_images: (T, 3, 96, 96)
        mel_chunks: (N, 1, 80, 16)
        Returns generated frames of shape (T, 3, 96, 96).
        """
        num_mel_chunks = mel_chunks.shape[0]
        # Pad the video sequence at the beginning/end to handle window boundaries
        padded_faces = np.pad(face_images, ((2, 2), (0, 0), (0, 0), (0, 0)), mode="edge")
        generated = []

        for i in range(num_mel_chunks):
            center = i + 2
            # Take a 6-frame window around the center frame
            vid_chunk = padded_faces[center - 2 : center + 4]
            if vid_chunk.shape[0] < 6:
                pad_count = 6 - vid_chunk.shape[0]
                vid_chunk = np.pad(
                    vid_chunk, ((0, pad_count), (0, 0), (0, 0), (0, 0)), mode="edge"
                )

            mel_input = mel_chunks[i : i + 1]
            vid_input = vid_chunk[np.newaxis, ...]  # (1, 6, 3, 96, 96)
            # The ONNX model expects vid input shape (B, 6, 96, 96), so we collapse
            # the 3 color channels into grayscale across the 6 frames.
            vid_gray = np.mean(vid_input, axis=2)  # (1, 6, 96, 96)
            outputs = self.session.run(None, {"mel": mel_input, "vid": vid_gray})
            gen_frame = outputs[0][0]  # (3, 96, 96)
            generated.append(gen_frame)

        return np.array(generated, dtype=np.float32)

    def _merge_audio(self, video_path: str, audio_path: str, output_path: str):
        """Merge generated video with original audio using FFmpeg."""
        import subprocess

        cmd = [
            "ffmpeg",
            "-y",
            "-i",
            video_path,
            "-i",
            audio_path,
            "-c:v",
            "libx264",
            "-c:a",
            "aac",
            "-shortest",
            "-pix_fmt",
            "yuv420p",
            output_path,
        ]
        subprocess.run(cmd, capture_output=True, text=True, check=True)

    def infer(self, audio_path: str, video_path: str, output_path: str) -> dict:
        """
        Run full audio-driven lip-sync inference and save the output video.
        Returns a dict with timing stats and output path.
        """
        import time

        start_time = time.time()

        frames, face_images, crop_box, fps = self._preprocess_video_frames(
            video_path, audio_path
        )
        mel_chunks = wav2lip_mel_chunks(audio_path)

        # Adjust mel_chunks to match number of frames
        if mel_chunks.shape[0] > len(frames):
            mel_chunks = mel_chunks[: len(frames)]
        elif mel_chunks.shape[0] < len(frames):
            pad_count = len(frames) - mel_chunks.shape[0]
            last_chunk = mel_chunks[-1:]
            mel_chunks = np.concatenate(
                [mel_chunks, np.repeat(last_chunk, pad_count, axis=0)], axis=0
            )

        gen_start = time.time()
        generated_faces = self._run_inference(face_images, mel_chunks)
        gen_time = time.time() - gen_start

        # Post-process: paste generated faces back into original frames
        out_frames = []
        for i, frame in enumerate(frames):
            gen_face = np.transpose(generated_faces[i], (1, 2, 0))
            gen_face = np.clip(gen_face * 255, 0, 255).astype(np.uint8)
            out_frame = paste_lip_region(frame, gen_face, crop_box)
            out_frames.append(out_frame)

        # Write output video with audio
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        h, w = frames[0].shape[:2]
        temp_video = output_path.replace(".mp4", "_temp.mp4")
        out = cv2.VideoWriter(temp_video, fourcc, fps, (w, h))
        for f in out_frames:
            out.write(f)
        out.release()

        # Combine with audio using ffmpeg
        self._merge_audio(temp_video, audio_path, output_path)
        if os.path.exists(temp_video):
            os.remove(temp_video)

        total_time = time.time() - start_time
        fps_generated = len(frames) / gen_time if gen_time > 0 else 0

        return {
            "output_path": output_path,
            "total_time_sec": round(total_time, 3),
            "inference_time_sec": round(gen_time, 3),
            "frames": len(frames),
            "fps_generated": round(fps_generated, 2),
            "latency_ms": round(total_time * 1000, 2),
        }
