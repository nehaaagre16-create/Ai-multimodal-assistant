
import cv2
import numpy as np
import os

base = "/home/paperclip/AI-Multimodal-Assistant"
img_path = os.path.join(base, "client/public/avatars/assistant_female_1.png")
sample_path = os.path.join(base, "avatar-service/samples/source_video.mp4")
os.makedirs(os.path.dirname(sample_path), exist_ok=True)

img = cv2.imread(img_path)
if img is None:
    raise RuntimeError(f"Failed to load image: {img_path}")
print(f"Loaded image: {img.shape}")
h, w = img.shape[:2]
target_h, target_w = 480, 640
scale = min(target_w / w, target_h / h)
new_w = int(w * scale)
new_h = int(h * scale)
resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)

fps = 25
duration = 5
total_frames = fps * duration
fourcc = cv2.VideoWriter_fourcc(*'mp4v')
out = cv2.VideoWriter(sample_path, fourcc, fps, (target_w, target_h))

for i in range(total_frames):
    t = i / total_frames
    angle = 2 * np.pi * t
    scale_factor = 1.0 + 0.005 * np.sin(angle * 2)
    tx = (target_w - new_w) // 2
    ty = (target_h - new_h) // 2 + int(2 * np.sin(angle * 2))
    M = cv2.getRotationMatrix2D((new_w / 2, new_h / 2), 0, scale_factor)
    M[0, 2] += tx
    M[1, 2] += ty
    frame = cv2.warpAffine(resized, M, (target_w, target_h), borderValue=(0, 0, 0))
    out.write(frame)

out.release()
print(f"Created source video: {sample_path}, size: {os.path.getsize(sample_path)} bytes")

cap = cv2.VideoCapture(sample_path)
print(f"Video frames: {int(cap.get(cv2.CAP_PROP_FRAME_COUNT))}, fps: {cap.get(cv2.CAP_PROP_FPS)}, size: ({int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))}, {int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))})")
cap.release()
