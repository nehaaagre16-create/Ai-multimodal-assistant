import os
import sys
import logging
from pathlib import Path

# Configure logging before other imports
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("avatar_service")

from contextlib import asynccontextmanager
from typing import Optional
import tempfile
import time

import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

# Add project src to path
BASE_DIR = Path(__file__).resolve().parent
SRC_DIR = BASE_DIR / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from inference import Wav2LipInference
from tts_service import PiperTTS

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

MODEL_PATH = os.environ.get("WAV2LIP_MODEL", str(BASE_DIR / "models/wav2lip/wav2lip_gan.onnx"))
FACE_PROTO = os.environ.get("FACE_DETECTOR_PROTO", str(BASE_DIR / "models/face_detection/deploy.prototxt"))
FACE_MODEL = os.environ.get("FACE_DETECTOR_MODEL", str(BASE_DIR / "models/face_detection/res10_300x300_ssd_iter_140000.caffemodel"))
DEFAULT_VIDEO = os.environ.get("DEFAULT_SOURCE_VIDEO", str(BASE_DIR / "samples/source_video.mp4"))
PIPER_MODEL = os.environ.get("PIPER_MODEL", str(BASE_DIR / "models/piper/en_US-amy-medium.onnx"))
PIPER_CONFIG = os.environ.get("PIPER_CONFIG", str(BASE_DIR / "models/piper/en_US-amy-medium.onnx.json"))
PIPER_EXEC = os.environ.get("PIPER_EXEC", str(BASE_DIR / ".venv/bin/piper"))
OUTPUT_DIR = BASE_DIR / "outputs"
OUTPUT_DIR.mkdir(exist_ok=True)

SERVICE_HOST = os.environ.get("AVATAR_HOST", "0.0.0.0")
SERVICE_PORT = int(os.environ.get("AVATAR_PORT", "9000"))

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    status: str = "ok"
    model_loaded: bool
    model_path: str
    service: str = "python-avatar-service"

class SpeakRequest(BaseModel):
    audio_url: str = Field(..., description="URL or local path to the TTS audio file")
    source_video: Optional[str] = Field(default=None, description="Optional path/URL to source video")
    output_format: str = Field(default="mp4", description="Output format: mp4 only for now")

class SpeakTextRequest(BaseModel):
    text: str = Field(..., description="Text to synthesize and lip-sync")
    source_video: Optional[str] = Field(default=None, description="Optional path/URL to source video")
    speaker_id: Optional[int] = Field(default=None, description="Optional Piper speaker id")

class SpeakResponse(BaseModel):
    output_path: str
    total_time_sec: float
    inference_time_sec: float
    frames: int
    fps_generated: float
    latency_ms: float

class SpeakTextResponse(BaseModel):
    audio_url: str
    video_url: str
    tts_time_sec: float
    inference_time_sec: float
    total_time_sec: float
    frames: int
    fps_generated: float
    latency_ms: float
    duration_sec: float

# ---------------------------------------------------------------------------
# Global inference instance (loaded at startup)
# ---------------------------------------------------------------------------

inference_engine: Optional[Wav2LipInference] = None
tts_engine: Optional[PiperTTS] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global inference_engine, tts_engine
    logger.info("Loading Wav2Lip ONNX model...")
    try:
        inference_engine = Wav2LipInference(
            model_path=str(MODEL_PATH),
            face_detector_proto=str(FACE_PROTO),
            face_detector_model=str(FACE_MODEL),
        )
        logger.info("Wav2Lip model loaded successfully on CPU.")
    except Exception as exc:
        logger.error("Failed to load Wav2Lip model: %s", exc, exc_info=True)
        inference_engine = None

    logger.info("Loading Piper TTS model...")
    try:
        tts_engine = PiperTTS(
            model_path=str(PIPER_MODEL),
            config_path=str(PIPER_CONFIG),
            piper_executable=str(PIPER_EXEC),
        )
        logger.info("Piper TTS loaded successfully on CPU.")
    except Exception as exc:
        logger.error("Failed to load Piper TTS: %s", exc, exc_info=True)
        tts_engine = None

    yield
    logger.info("Shutting down avatar service.")
    inference_engine = None
    tts_engine = None


app = FastAPI(
    title="AI Multimodal Assistant - Python Avatar Service",
    description="CPU-only Wav2Lip ONNX avatar generation service.",
    version="2.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def download_url(url: str, dest: Path) -> Path:
    """Download a URL to a local file if it is not already local."""
    if url.startswith("http://") or url.startswith("https://"):
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                raise HTTPException(status_code=400, detail=f"Failed to download audio: {resp.status_code}")
            dest.write_bytes(resp.content)
        return dest
    else:
        # Local path
        local = Path(url)
        if not local.exists():
            raise HTTPException(status_code=404, detail=f"Local audio file not found: {url}")
        return local


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok" if inference_engine is not None else "degraded",
        model_loaded=inference_engine is not None,
        model_path=str(MODEL_PATH),
    )


@app.get("/")
async def root():
    return {"service": "python-avatar-service", "status": "ok" if inference_engine else "degraded"}


@app.post("/speak", response_model=SpeakResponse)
async def speak(request: SpeakRequest):
    if inference_engine is None:
        raise HTTPException(status_code=503, detail="Avatar inference engine is not loaded")

    start = time.time()

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        audio_local = await download_url(request.audio_url, tmp_path / "audio.wav")
        source_video = request.source_video or str(DEFAULT_VIDEO)

        output_path = OUTPUT_DIR / f"output_{int(start)}_{audio_local.stem}.mp4"

        try:
            stats = inference_engine.infer(
                audio_path=str(audio_local),
                video_path=source_video,
                output_path=str(output_path),
            )
        except Exception as exc:
            logger.error("Inference failed: %s", exc, exc_info=True)
            raise HTTPException(status_code=500, detail=f"Inference failed: {exc}")

    return SpeakResponse(**stats)


@app.post("/speak_text", response_model=SpeakTextResponse)
async def speak_text(request: SpeakTextRequest):
    """Synthesize text with Piper and generate a lip-synced avatar video."""
    if inference_engine is None:
        raise HTTPException(status_code=503, detail="Avatar inference engine is not loaded")
    if tts_engine is None:
        raise HTTPException(status_code=503, detail="TTS engine is not loaded")

    total_start = time.time()
    source_video = request.source_video or str(DEFAULT_VIDEO)
    timestamp = int(total_start)
    audio_path = OUTPUT_DIR / f"audio_{timestamp}.wav"
    video_path = OUTPUT_DIR / f"output_{timestamp}.mp4"

    try:
        tts_start = time.time()
        tts_info = tts_engine.synthesize(request.text, str(audio_path), speaker_id=request.speaker_id)
        tts_time = time.time() - tts_start
    except Exception as exc:
        logger.error("TTS failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"TTS failed: {exc}")

    try:
        stats = inference_engine.infer(
            audio_path=str(audio_path),
            video_path=source_video,
            output_path=str(video_path),
        )
    except Exception as exc:
        logger.error("Inference failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Inference failed: {exc}")

    total_time = time.time() - total_start
    return SpeakTextResponse(
        audio_url=f"/outputs/{audio_path.name}",
        video_url=f"/outputs/{video_path.name}",
        tts_time_sec=round(tts_time, 3),
        inference_time_sec=stats["inference_time_sec"],
        total_time_sec=round(total_time, 3),
        frames=stats["frames"],
        fps_generated=stats["fps_generated"],
        latency_ms=round(total_time * 1000, 2),
        duration_sec=tts_info["duration_sec"],
    )


@app.websocket("/ws/speak")
async def websocket_speak(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket connection accepted")
    try:
        while True:
            data = await websocket.receive_json()
            audio_url = data.get("audio_url")
            source_video = data.get("source_video", str(DEFAULT_VIDEO))
            if not audio_url:
                await websocket.send_json({"error": "Missing audio_url"})
                continue

            if inference_engine is None:
                await websocket.send_json({"error": "Inference engine not loaded"})
                continue

            with tempfile.TemporaryDirectory() as tmpdir:
                tmp_path = Path(tmpdir)
                audio_local = await download_url(audio_url, tmp_path / "audio.wav")
                output_path = OUTPUT_DIR / f"output_{int(time.time())}_{audio_local.stem}.mp4"

                try:
                    stats = inference_engine.infer(
                        audio_path=str(audio_local),
                        video_path=source_video,
                        output_path=str(output_path),
                    )
                    await websocket.send_json({
                        "type": "complete",
                        "output_url": f"/outputs/{output_path.name}",
                        "stats": stats,
                    })
                except Exception as exc:
                    logger.error("WebSocket inference failed: %s", exc, exc_info=True)
                    await websocket.send_json({"error": str(exc)})

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as exc:
        logger.error("WebSocket error: %s", exc, exc_info=True)
        try:
            await websocket.close()
        except Exception:
            pass


@app.get("/outputs/{filename}")
async def get_output(filename: str):
    file_path = OUTPUT_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Output file not found")
    return FileResponse(file_path, media_type="video/mp4")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=SERVICE_HOST, port=SERVICE_PORT)
