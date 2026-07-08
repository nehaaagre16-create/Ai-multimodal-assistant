
import sys
import os
sys.path.insert(0, "/home/paperclip/AI-Multimodal-Assistant/avatar-service/src")
from tts_service import PiperTTS

audio_path = "/home/paperclip/AI-Multimodal-Assistant/avatar-service/samples/piper_test3.wav"
service = PiperTTS(
    model_path="/home/paperclip/AI-Multimodal-Assistant/avatar-service/models/piper/en_US-amy-medium.onnx",
    config_path="/home/paperclip/AI-Multimodal-Assistant/avatar-service/models/piper/en_US-amy-medium.onnx.json",
    piper_executable="/home/paperclip/AI-Multimodal-Assistant/avatar-service/.venv/bin/piper",
)
result = service.synthesize("Hello, this is a test of the open source talking avatar.", audio_path)
print(result)
print(f"Generated audio size: {os.path.getsize(audio_path)}")
