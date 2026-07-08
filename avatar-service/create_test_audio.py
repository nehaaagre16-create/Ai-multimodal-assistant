
import numpy as np
import soundfile as sf
import os

audio_path = "/home/paperclip/AI-Multimodal-Assistant/avatar-service/samples/test_audio.wav"
os.makedirs(os.path.dirname(audio_path), exist_ok=True)
sr = 16000
duration = 1.0
t = np.linspace(0, duration, int(sr * duration))
wave = 0.5 * np.sin(2 * np.pi * 440 * t)
sf.write(audio_path, wave, sr)
print(f"Created test audio: {audio_path}, size: {os.path.getsize(audio_path)}")
