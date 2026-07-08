import numpy as np
import librosa
import soundfile as sf
from typing import Tuple


def load_audio(path: str, sr: int = 16000) -> Tuple[np.ndarray, int]:
    """Load audio and resample to target sample rate."""
    wav, _ = librosa.load(path, sr=sr)
    return wav, sr


def audio_to_mel_spectrogram(wav: np.ndarray, sr: int = 16000) -> np.ndarray:
    """
    Convert audio waveform to a mel spectrogram matching the Wav2Lip ONNX model.
    Output shape: (80, T) where T is the number of time frames.
    """
    # Parameters from the original Wav2Lip implementation
    mel = librosa.feature.melspectrogram(
        y=wav,
        sr=sr,
        n_fft=800,
        hop_length=200,
        win_length=800,
        n_mels=80,
        fmin=55,
        fmax=7600,
        power=1.0
    )
    mel = np.log(mel + 1e-6)  # log compression
    return mel


def prepare_mel_chunks(mel: np.ndarray, chunk_size: int = 16) -> np.ndarray:
    """
    Pad mel spectrogram so it is divisible by chunk_size and split into chunks.
    Returns array of shape (num_chunks, 1, 80, chunk_size).
    """
    num_frames = mel.shape[1]
    pad = chunk_size - (num_frames % chunk_size) if num_frames % chunk_size != 0 else 0
    if pad > 0:
        mel = np.pad(mel, ((0, 0), (0, pad)), mode="edge")

    num_chunks = mel.shape[1] // chunk_size
    chunks = np.zeros((num_chunks, 1, 80, chunk_size), dtype=np.float32)
    for i in range(num_chunks):
        chunks[i, 0] = mel[:, i * chunk_size:(i + 1) * chunk_size]
    return chunks


def wav2lip_mel_chunks(audio_path: str, sr: int = 16000) -> np.ndarray:
    """Convenience function: audio file -> mel chunks for Wav2Lip."""
    wav, sr = load_audio(audio_path, sr)
    mel = audio_to_mel_spectrogram(wav, sr)
    return prepare_mel_chunks(mel)
