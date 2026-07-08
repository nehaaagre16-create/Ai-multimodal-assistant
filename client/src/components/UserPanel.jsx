import { useState, useRef, useEffect } from 'react'
import { Camera, CameraOff, Mic, MicOff, Settings } from 'lucide-react'

export default function UserPanel({ isListening, onToggleMic, cameraOn, onCameraToggle, isVideoListening, onToggleVideoMic }) {
  const [audioLevel, setAudioLevel] = useState(0)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const micActiveRef = useRef(false)

  useEffect(() => {
    if (cameraOn) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(stream => {
          streamRef.current = stream
          if (videoRef.current) videoRef.current.srcObject = stream
        })
        .catch(() => onCameraToggle(false))
    } else {
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
      if (videoRef.current) videoRef.current.srcObject = null
    }
    return () => streamRef.current?.getTracks().forEach(t => t.stop())
  }, [cameraOn, onCameraToggle])

  const micActive = isVideoListening || isListening

  useEffect(() => {
    if (!micActive) {
      setAudioLevel(0)
      return
    }
    micActiveRef.current = true
    let cancelled = false
    let ctx, analyser, raf
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        ctx = new (window.AudioContext || window.webkitAudioContext)()
        analyser = ctx.createAnalyser()
        const source = ctx.createMediaStreamSource(stream)
        source.connect(analyser)
        analyser.fftSize = 64
        const data = new Uint8Array(analyser.frequencyBinCount)
        const loop = () => {
          if (cancelled || !micActiveRef.current || !analyser) return
          analyser.getByteFrequencyData(data)
          const avg = data.reduce((a, b) => a + b, 0) / data.length
          setAudioLevel(avg / 255)
          raf = requestAnimationFrame(loop)
        }
        loop()
      })
      .catch(() => {})
    return () => {
      cancelled = true
      micActiveRef.current = false
      if (raf) cancelAnimationFrame(raf)
      if (ctx) ctx.close()
      setAudioLevel(0)
    }
  }, [micActive])

  return (
    <div style={{
      flex: 1,
      minHeight: 0,
      borderRadius: 16,
      background: '#141414',
      border: '1px solid #2A2A2A',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute',
        top: 12,
        left: 12,
        padding: '4px 10px',
        borderRadius: 8,
        background: '#0A0A0ACC',
        fontSize: 12,
        fontWeight: 600,
        color: '#F5F5F5',
        zIndex: 2,
      }}>
        You
      </div>

      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: cameraOn ? '#0A0A0A' : '#1E1E1E',
        position: 'relative',
      }}>
        {cameraOn ? (
          <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: '#2A2A2A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <CameraOff size={32} color="#525252" />
          </div>
        )}

        {micActive && (
          <div style={{
            position: 'absolute',
            bottom: 40,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'flex-end',
            gap: 3,
            height: 30,
          }}>
            {[...Array(8)].map((_, i) => {
              const deterministicOffset = (i + 1) * 3
              return (
                <div key={i} style={{
                  width: 4,
                  height: Math.max(6, audioLevel * 30 + deterministicOffset),
                  borderRadius: 2,
                  background: '#00D4FF',
                  transition: 'height 0.1s',
                }} />
              )
            })}
          </div>
        )}
      </div>

      <div style={{
        padding: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        borderTop: '1px solid #2A2A2A',
      }}>
        <button onClick={() => onCameraToggle(!cameraOn)} style={controlBtnStyle(cameraOn ? '#00FF88' : '#A3A3A3')}>
          {cameraOn ? <Camera size={18} /> : <CameraOff size={18} />}
        </button>
        <button onClick={onToggleVideoMic} aria-label={isVideoListening ? 'Stop video microphone' : 'Start video microphone'} style={controlBtnStyle(isVideoListening ? '#FF4444' : '#A3A3A3')}>
          {isVideoListening ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        <button style={controlBtnStyle('#A3A3A3')}>
          <Settings size={18} />
        </button>
      </div>
    </div>
  )
}

const controlBtnStyle = (color) => ({
  width: 36,
  height: 36,
  borderRadius: '50%',
  border: '1px solid #2A2A2A',
  background: '#1E1E1E',
  color,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
})
