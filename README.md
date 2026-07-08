# AI Multimodal Assistant

A smart AI assistant with real-time chat, voice, vision, and a talking avatar.

## What it does

- **Chat**: Talk to a Gemini-powered AI.
- **Voice**: Speak to the AI using your microphone.
- **Avatar**: Watch an animated avatar respond.
- **Vision**: Upload images and ask questions about them.
- **Files**: Upload, preview, and manage files.
- **History**: Search and reuse past conversations.

## Tech stack

| Part | Technology |
|------|------------|
| Frontend | React 19 + Vite 8 + Tailwind CSS v4 |
| Backend | Node.js + Express + Socket.IO |
| Database | SQLite (via `better-sqlite3`) |
| AI | Google Gemini (OpenAI-compatible endpoint) |
| Avatar service | Python + FastAPI + ONNX Runtime + Wav2Lip + Piper TTS |
| Container | Docker + Docker Compose |

## Project location

```
/home/paperclip/AI-Multimodal-Assistant
```

## Ports

| Service | Port | URL |
|---------|------|-----|
| Frontend | 5173 | http://localhost:5173 |
| Backend | 4001 | http://localhost:4001 |

## Quick start (local development)

### 1. Clone the repo

```bash
git clone https://github.com/nehaaagre16-create/Ai-multimodal-assistant.git
cd Ai-multimodal-assistant
```

### 2. Set environment variables

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
cp avatar-service/.env.example avatar-service/.env
```

Open the `.env` files and add your Google API key:

```bash
# server/.env
GOOGLE_API_KEY=your_google_api_key_here
```

Get a key here: https://aistudio.google.com/app/apikey

### 3. Install dependencies

```bash
npm run install:all
```

### 4. Download avatar models

The AI models are large and not stored in Git. Run this once:

```bash
cd avatar-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python download_models.py
```

### 5. Start all services

```bash
npm run dev
```

This starts:
- Backend on `http://localhost:4001`
- Frontend on `http://localhost:5173`
- Avatar service on `http://localhost:8000`

### 6. Open the app

Go to http://localhost:5173 in your browser.

## Quick start (Docker)

If you have Docker installed:

```bash
# 1. Set your API key
export GOOGLE_API_KEY=your_google_api_key_here

# 2. Build and run
docker-compose up --build
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4001

Note: Docker currently does not download the Wav2Lip/Piper models automatically. For full avatar support, run the avatar service locally using the steps above.

## Environment variables

### `server/.env`

| Variable | Description | Default |
|----------|-------------|---------|
| `GOOGLE_API_KEY` | Your Google AI Studio API key | (required) |
| `PORT` | Backend port | `4001` |
| `UPLOAD_DIR` | Where uploaded files are stored | `uploads` |
| `MAX_FILE_SIZE` | Max upload size in bytes | `10485760` (10 MB) |
| `GEMINI_BASE_URL` | Gemini OpenAI-compatible endpoint | `https://generativelanguage.googleapis.com/v1beta/openai` |
| `AI_MODEL` | Chat model | `gemini-2.5-flash` |
| `VISION_MODEL` | Vision model | `gemini-2.5-flash` |
| `SUMMARY_MODEL` | Summary model | `gemini-2.5-flash` |

### `client/.env`

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend URL | `http://localhost:4001` |

### `avatar-service/.env`

| Variable | Description | Default |
|----------|-------------|---------|
| `WAV2LIP_MODEL` | Path to Wav2Lip ONNX model | `models/wav2lip/wav2lip_gan.onnx` |
| `PIPER_MODEL` | Path to Piper TTS ONNX model | `models/piper/en_US-amy-medium.onnx` |
| `PIPER_CONFIG` | Path to Piper TTS config | `models/piper/en_US-amy-medium.onnx.json` |
| `FACE_DETECTOR_MODEL` | Path to face detector model | `models/face_detection/res10_300x300_ssd_iter_140000.caffemodel` |
| `FACE_DETECTOR_PROTO` | Path to face detector proto | `models/face_detection/deploy.prototxt` |

## Folder structure

```
Ai-Multimodal-Assistant/
├── client/              # React frontend
├── server/              # Node.js backend
├── avatar-service/      # Python avatar/TTS service
│   ├── models/          # Downloaded AI models
│   ├── src/             # Service source code
│   └── download_models.py
├── docs/                # Architecture docs
└── e2e/                 # Playwright tests
```

## Scripts

| Script | What it does |
|--------|--------------|
| `npm run install:all` | Install dependencies for all services |
| `npm run dev` | Start all services in parallel |
| `npm run build` | Build the frontend |
| `npm run download:models` | Download avatar AI models |
| `npm run test:e2e` | Run Playwright tests |

## Notes

- The frontend runs on Vite dev server, not the backend port.
- The default AI voice is female. To change voice/preset, open the app Settings page.
- Do not commit real API keys or upload files.
