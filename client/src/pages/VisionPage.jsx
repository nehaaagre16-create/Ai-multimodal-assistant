import { useState, useRef, useEffect } from 'react'
import { Camera, CameraOff, Send, Eye, Loader2, ImagePlus, X, Monitor, MonitorOff } from 'lucide-react'
import API_BASE from '../config/api';

export default function VisionPage({ cameraOn: parentCameraOn, onCameraToggle }) {
  const [cameraOn, setCameraOn] = useState(parentCameraOn || false)
  const [screenOn, setScreenOn] = useState(false)
  const [capturedImage, setCapturedImage] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    onCameraToggle(cameraOn || screenOn)
  }, [cameraOn, screenOn, onCameraToggle])

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  useEffect(() => scrollToBottom(), [messages])

  // Start camera
  const startCamera = async () => {
    try {
      setError(null)
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported in this browser')
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setCameraOn(true)
    } catch (err) {
      setError('Camera error: ' + err.message)
      setCameraOn(false)
    }
  }

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setCameraOn(false)
    setScreenOn(false)
  }

  // Start screen share
  const startScreenShare = async () => {
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: 1280, height: 720 }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setScreenOn(true)
      setCameraOn(true)
      // Auto-stop when user stops sharing
      stream.getVideoTracks()[0].onended = () => {
        stopCamera()
      }
    } catch (err) {
      setError('Screen share error: ' + err.message)
      setScreenOn(false)
    }
  }

  // Capture frame
  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = 512
    canvas.height = 384
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, 512, 384)
    const base64 = canvas.toDataURL('image/jpeg', 0.85)
    setCapturedImage(base64)
  }

  // Clear captured image
  const clearCapture = () => {
    setCapturedImage(null)
  }

  // Send image + question to backend
  const sendVisionRequest = async (text) => {
    if (!capturedImage && !text.trim()) return

    const userMsg = {
      role: 'user',
      content: text || 'What do you see in this image?',
      image: capturedImage,
      timestamp: Date.now()
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsAnalyzing(true)

    try {
      const res = await fetch(`${API_BASE}/api/vision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: capturedImage,
          question: text || 'What do you see in this image?'
        })
      })

      const data = await res.json()
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.description || data.error || 'No response',
        timestamp: Date.now()
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Error: ' + err.message,
        timestamp: Date.now()
      }])
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleSend = () => {
    if (!input.trim() && !capturedImage) return
    sendVisionRequest(input.trim())
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Left: Camera Panel */}
      <div style={{
        width: '50%',
        borderRight: '1px solid #2A2A2A',
        display: 'flex',
        flexDirection: 'column',
        padding: 24,
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Eye size={22} color="#00D4FF" />
            <span style={{ fontSize: 16, fontWeight: 600 }}>Vision</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {cameraOn || screenOn ? (
              <button onClick={stopCamera} style={iconBtnStyle}>
                {screenOn ? <MonitorOff size={18} color="#FF4444" /> : <CameraOff size={18} color="#FF4444" />}
              </button>
            ) : (
              <>
                <button onClick={startCamera} style={iconBtnStyle}>
                  <Camera size={18} color="#00D4FF" />
                </button>
                <button onClick={startScreenShare} style={iconBtnStyle}>
                  <Monitor size={18} color="#00D4FF" />
                </button>
              </>
            )}
            {(cameraOn || screenOn) && (
              <button onClick={captureFrame} style={{ ...iconBtnStyle, background: '#00D4FF20' }}>
                <ImagePlus size={18} color="#00D4FF" />
              </button>
            )}
          </div>
        </div>

        {error && (
          <div style={{
            padding: 12,
            background: '#FF444410',
            border: '1px solid #FF444430',
            borderRadius: 10,
            color: '#FF4444',
            fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {/* Camera preview or captured image */}
        <div style={{
          flex: 1,
          background: '#141414',
          borderRadius: 16,
          border: '1px solid #2A2A2A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
        }}>
          {capturedImage ? (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <img
                src={capturedImage}
                alt="Captured"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
              <button
                onClick={clearCapture}
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: 'none',
                  background: '#FF4444',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: 16,
                  display: cameraOn ? 'block' : 'none',
                }}
              />
              {!cameraOn && (
                <div style={{
                  position: 'absolute',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                  color: '#525252',
                }}>
                  <Camera size={48} />
                  <span style={{ fontSize: 14 }}>Click camera to start</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      {/* Right: Chat/Analysis Panel */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: 24,
      }}>
        <div style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          marginBottom: 16,
        }}>
          {messages.length === 0 && (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#525252',
              gap: 12,
            }}>
              <Eye size={48} />
              <p style={{ fontSize: 14 }}>Capture an image and ask the AI about it</p>
              <p style={{ fontSize: 12, color: '#737373' }}>Or just describe what you want analyzed</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{
              display: 'flex',
              gap: 12,
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
            }}>
              {msg.role === 'assistant' && (
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: '#00D4FF20',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Eye size={14} color="#00D4FF" />
                </div>
              )}
              <div style={{
                background: msg.role === 'user' ? '#1E1E1E' : '#141414',
                border: '1px solid #2A2A2A',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                padding: '12px 16px',
                fontSize: 14,
                lineHeight: 1.6,
                color: '#F5F5F5',
                wordBreak: 'break-word',
              }}>
                {msg.image && (
                  <img
                    src={msg.image}
                    alt="Captured"
                    style={{
                      maxWidth: 200,
                      maxHeight: 150,
                      borderRadius: 8,
                      marginBottom: 8,
                      display: 'block',
                    }}
                  />
                )}
                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
              </div>
            </div>
          ))}

          {isAnalyzing && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: '#00D4FF',
              fontSize: 13,
            }}>
              <Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
              Analyzing...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          borderTop: '1px solid #2A2A2A',
          paddingTop: 16,
        }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={capturedImage ? 'Ask about the image...' : 'Capture an image first...'}
            disabled={!capturedImage || isAnalyzing}
            style={{
              flex: 1,
              background: '#141414',
              border: '1px solid #2A2A2A',
              borderRadius: 12,
              padding: '12px 16px',
              color: '#F5F5F5',
              fontSize: 14,
              outline: 'none',
            }}
          />
          <button
            onClick={handleSend}
            disabled={(!input.trim() && !capturedImage) || isAnalyzing}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              border: 'none',
              background: (input.trim() || capturedImage) && !isAnalyzing ? '#00D4FF' : '#1E1E1E',
              color: (input.trim() || capturedImage) && !isAnalyzing ? '#0A0A0A' : '#525252',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: (input.trim() || capturedImage) && !isAnalyzing ? 'pointer' : 'not-allowed',
            }}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

const iconBtnStyle = {
  width: 36,
  height: 36,
  borderRadius: 10,
  border: '1px solid #2A2A2A',
  background: '#1E1E1E',
  color: '#A3A3A3',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'all 0.15s',
}
