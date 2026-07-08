
import sys
import os
sys.path.insert(0, "/home/paperclip/AI-Multimodal-Assistant/avatar-service/src")
from piper import PiperVoice

output_path = "/home/paperclip/AI-Multimodal-Assistant/avatar-service/samples/piper_test2.wav"
voice = PiperVoice.load("/home/paperclip/AI-Multimodal-Assistant/avatar-service/models/piper/en_US-amy-medium.onnx", config_path="/home/paperclip/AI-Multimodal-Assistant/avatar-service/models/piper/en_US-amy-medium.onnx.json", use_cuda=False)
print("Voice sample rate:", voice.config.sample_rate)
print("Voice speakers:", voice.config.num_speakers)

with open(output_path, "wb") as f:
    voice.synthesize("Hello, this is a test of the open source talking avatar.", f)

print(f"File size: {os.path.getsize(output_path)}")
