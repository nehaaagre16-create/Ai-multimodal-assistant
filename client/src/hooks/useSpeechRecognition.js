import { useRef, useCallback, useEffect } from 'react'

/**
 * useSpeechRecognition — stable wrapper for Web Speech API.
 *
 * Modes:
 *   dictation   (default): continuous=false, interimResults=true.
 *                            Caller receives final transcript chunks via onFinal
 *                            and should treat each chunk as a completed sentence.
 *   continuous  : continuous=true, interimResults=true.
 *                            Used by the video mic for hands-free conversation.
 *                            Final results are accumulated and flushed once after
 *                            a silence pause, so each spoken sentence produces
 *                            exactly one user message.
 *
 * Only one recognition instance runs at a time. The hook guards against both
 * this process and other mic owners by requiring an exclusive lock function.
 */
export default function useSpeechRecognition({
  mode = 'dictation',
  lang = 'en-US',
  silenceTimeoutMs = 1200,
  onFinal,
  onInterim,
  onError,
  onStateChange,
  acquireLock,
  releaseLock,
}) {
  const recognitionRef = useRef(null)
  const finalBufferRef = useRef('')
  const interimBufferRef = useRef('')
  const silenceTimerRef = useRef(null)
  const activeRef = useRef(false)
  const lockOwnerRef = useRef(false)
  const restartPendingRef = useRef(false)

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    clearSilenceTimer()
    activeRef.current = false
    restartPendingRef.current = false
    if (lockOwnerRef.current) {
      lockOwnerRef.current = false
      releaseLock?.()
    }
    try {
      recognitionRef.current?.stop()
    } catch {
      // already stopped
    }
    onStateChange?.(false)
  }, [clearSilenceTimer, releaseLock, onStateChange])

  const resetBuffers = useCallback(() => {
    finalBufferRef.current = ''
    interimBufferRef.current = ''
  }, [])

  const flushFinal = useCallback(() => {
    const text = finalBufferRef.current.trim()
    if (text) {
      onFinal?.(text)
    }
    resetBuffers()
  }, [onFinal, resetBuffers])

  const scheduleAutoSend = useCallback(() => {
    if (mode !== 'continuous') return
    clearSilenceTimer()
    silenceTimerRef.current = setTimeout(() => {
      flushFinal()
    }, silenceTimeoutMs)
  }, [mode, silenceTimeoutMs, clearSilenceTimer, flushFinal])

  const handleResult = useCallback((e) => {
    let interim = ''
    let final = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const transcript = e.results[i][0].transcript
      if (e.results[i].isFinal) {
        final += transcript
      } else {
        interim += transcript
      }
    }

    if (mode === 'dictation') {
      // Each final chunk is a sentence; interim is shown but not committed.
      if (interim) {
        interimBufferRef.current = interim
        onInterim?.(interim)
      }
      if (final) {
        finalBufferRef.current = final
        flushFinal()
      }
      return
    }

    // continuous mode
    if (interim) {
      interimBufferRef.current = interim
      onInterim?.(interim)
      // User is still speaking; cancel any pending auto-send.
      clearSilenceTimer()
    }
    if (final) {
      // Accumulate final results and schedule a single flush after silence.
      finalBufferRef.current = (finalBufferRef.current + ' ' + final).trim()
      scheduleAutoSend()
    }
  }, [mode, onInterim, flushFinal, clearSilenceTimer, scheduleAutoSend])

  const createRecognition = useCallback(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      onError?.(new Error('Speech recognition not supported'))
      return null
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const r = new SpeechRecognition()
    r.continuous = mode === 'continuous'
    r.interimResults = true
    r.lang = lang

    r.onresult = handleResult
    r.onerror = (e) => {
      // Ignore benign errors that fire when the user stops manually.
      if (e.error === 'aborted' || e.error === 'no-speech') {
        stop()
        return
      }
      onError?.(e)
      stop()
    }
    r.onend = () => {
      // In continuous mode, if we are still meant to be active, create a fresh
      // instance and start it. Reusing the same instance often fails in Chrome.
      if (activeRef.current && mode === 'continuous') {
        restartPendingRef.current = true
        window.setTimeout(() => {
          if (!activeRef.current) {
            restartPendingRef.current = false
            return
          }
          const fresh = createRecognition()
          if (fresh) {
            recognitionRef.current = fresh
            try {
              fresh.start()
              restartPendingRef.current = false
            } catch (err) {
              onError?.(err)
              stop()
            }
          }
        }, 50)
        return
      }
      onStateChange?.(false)
    }

    return r
  }, [mode, lang, handleResult, onError, stop, onStateChange])

  const start = useCallback(() => {
    if (activeRef.current) return true

    const gotLock = acquireLock?.() ?? true
    if (!gotLock) return false
    lockOwnerRef.current = true

    activeRef.current = true

    let r = recognitionRef.current
    if (!r || restartPendingRef.current) {
      r = createRecognition()
      recognitionRef.current = r
    }
    if (!r) {
      activeRef.current = false
      lockOwnerRef.current = false
      releaseLock?.()
      return false
    }

    try {
      r.start()
      onStateChange?.(true)
      return true
    } catch (err) {
      activeRef.current = false
      lockOwnerRef.current = false
      releaseLock?.()
      onError?.(err)
      return false
    }
  }, [acquireLock, releaseLock, onStateChange, onError, createRecognition])

  const toggle = useCallback(() => {
    if (activeRef.current) {
      stop()
      return false
    }
    return start()
  }, [start, stop])

  useEffect(() => {
    const r = createRecognition()
    if (r) recognitionRef.current = r
    return () => {
      stop()
      try { recognitionRef.current?.stop() } catch {}
    }
  }, [])

  return { start, stop, toggle, isActive: () => activeRef.current }
}
