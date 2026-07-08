import os
import subprocess
import wave
from typing import Optional

import numpy as np


class PiperTTS:
    """Lightweight wrapper around the Piper text-to-speech CLI."""

    def __init__(self, model_path: str, config_path: str, piper_executable: str = "piper"):
        self.model_path = model_path
        self.config_path = config_path
        self.piper_executable = piper_executable

    def synthesize(self, text: str, output_path: str, speaker_id: Optional[int] = None) -> dict:
        """
        Synthesize text into a WAV file using the Piper CLI.
        Returns dict with sample_rate, duration_sec, and path.
        """
        cmd = [
            self.piper_executable,
            "--model", self.model_path,
            "--config", self.config_path,
            "--output_file", output_path,
        ]
        if speaker_id is not None:
            cmd.extend(["--speaker", str(speaker_id)])

        result = subprocess.run(
            cmd,
            input=text,
            capture_output=True,
            text=True,
            check=True,
        )

        if not os.path.exists(output_path):
            raise RuntimeError(f"Piper did not produce output file. stderr: {result.stderr}")

        with wave.open(output_path, "rb") as wav_file:
            sample_rate = wav_file.getframerate()
            frames = wav_file.getnframes()

        duration_sec = frames / sample_rate
        return {
            "path": output_path,
            "sample_rate": sample_rate,
            "duration_sec": round(duration_sec, 3),
        }

    def synthesize_bytes(self, text: str, speaker_id: Optional[int] = None) -> bytes:
        """Return raw WAV bytes using a temporary file."""
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = tmp.name
        try:
            self.synthesize(text, tmp_path, speaker_id)
            with open(tmp_path, "rb") as f:
                return f.read()
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
