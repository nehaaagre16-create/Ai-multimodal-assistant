
import sys
sys.path.insert(0, "/home/paperclip/AI-Multimodal-Assistant/avatar-service/src")
from inference import Wav2LipInference
import os

engine = Wav2LipInference(
    model_path="/home/paperclip/AI-Multimodal-Assistant/avatar-service/models/wav2lip/wav2lip_gan.onnx",
    face_detector_proto="/home/paperclip/AI-Multimodal-Assistant/avatar-service/models/face_detection/deploy.prototxt",
    face_detector_model="/home/paperclip/AI-Multimodal-Assistant/avatar-service/models/face_detection/res10_300x300_ssd_iter_140000.caffemodel",
)
print("Engine loaded")
stats = engine.infer(
    audio_path="/home/paperclip/AI-Multimodal-Assistant/avatar-service/samples/test_audio.wav",
    video_path="/home/paperclip/AI-Multimodal-Assistant/avatar-service/samples/source_video.mp4",
    output_path="/home/paperclip/AI-Multimodal-Assistant/avatar-service/outputs/test_output.mp4",
)
print("Inference stats:", stats)
print("Output exists:", os.path.exists("/home/paperclip/AI-Multimodal-Assistant/avatar-service/outputs/test_output.mp4"), os.path.getsize("/home/paperclip/AI-Multimodal-Assistant/avatar-service/outputs/test_output.mp4") if os.path.exists("/home/paperclip/AI-Multimodal-Assistant/avatar-service/outputs/test_output.mp4") else 0)
