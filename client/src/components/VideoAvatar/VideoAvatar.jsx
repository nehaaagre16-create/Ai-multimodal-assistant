import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'

const VALID_STATES = ['idle', 'listening', 'thinking', 'speaking']

const STATE_FILTERS = {
  idle: 'none',
  listening: 'none',
  thinking: 'none',
  speaking: 'none',
}

const STATE_SCALES = {
  idle: 1,
  listening: 1,
  thinking: 1,
  speaking: 1,
}

const STATE_TRANSITIONS = {
  idle: 'none',
  listening: 'none',
  thinking: 'none',
  speaking: 'none',
}

/**
 * VideoAvatar — reusable HTML5 video avatar renderer.
 *
 * Public interface (matches the existing AvatarRenderer contract):
 *   mount(container)     — mount the video element into a DOM node
 *   render(state, portrait) — update data attributes and visual state
 *   playAudio(audio)     — play supplied audio; `audio` is { url, text, onFinished }
 *   stopAudio()          — stop audio playback
 *   destroy()            — remove the video element and clean up
 *   setPreset(preset)    — alias to keep parity with other renderers
 *
 * Video-specific props:
 *   src: string (video URL) — required
 *   poster?: string
 *   muted?: boolean        — defaults to true for autoplay compatibility
 *   loop?: boolean         — defaults to true
 *   objectFit?: 'cover' | 'contain' | 'fill' — defaults to 'cover'
 *   className?: string
 *   style?: React.CSSProperties
 *   onReady?: () => void
 *   onError?: (err: Event) => void
 */
const VideoAvatar = forwardRef(function VideoAvatar(props, ref) {
  const {
    src,
    state = 'idle',
    poster,
    muted = true,
    loop = true,
    objectFit = 'cover',
    className = '',
    style = {},
    onReady,
    onError,
    ...rest
  } = props

  const videoRef = useRef(null)
  const readyFired = useRef(false)

  useImperativeHandle(ref, () => ({
    play: () => videoRef.current?.play(),
    pause: () => videoRef.current?.pause(),
    element: () => videoRef.current,
  }))

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.muted = true
    video.loop = true
    video.autoplay = true
    video.playsInline = true
    video.preload = 'auto'

    const handleCanPlay = () => {
      if (!readyFired.current) {
        readyFired.current = true
        onReady?.()
      }
      const playPromise = video.play()
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {})
      }
    }

    const handleError = (e) => onError?.(e)

    const handleVisibility = () => {
      if (document.hidden) {
        video.pause()
      } else {
        const p = video.play()
        if (p && typeof p.catch === 'function') p.catch(() => {})
      }
    }

    video.addEventListener('canplay', handleCanPlay)
    video.addEventListener('error', handleError)
    document.addEventListener('visibilitychange', handleVisibility)

    if (video.readyState >= 2) {
      handleCanPlay()
    }

    return () => {
      video.removeEventListener('canplay', handleCanPlay)
      video.removeEventListener('error', handleError)
      document.removeEventListener('visibilitychange', handleVisibility)
      video.pause()
      video.src = ''
      video.load()
    }
  }, [src, onReady, onError])

  const safeState = VALID_STATES.includes(state) ? state : 'idle'

  const sources = src
    ? Array.isArray(src)
      ? src
      : [{ src: typeof src === 'string' ? src : src.src, type: typeof src === 'string' ? undefined : src.type }]
    : []

  return (
    <video
      ref={videoRef}
      className={className}
      data-avatar-state={safeState}
      poster={poster}
      muted={muted}
      loop={loop}
      autoPlay
      playsInline
      disablePictureInPicture
      disableRemotePlayback
      preload="auto"
      style={{
        width: '100%',
        height: '100%',
        objectFit,
        objectPosition: 'center',
        display: 'block',
        background: '#0a0a0a',
        filter: STATE_FILTERS[safeState],
        transform: `scale(${STATE_SCALES[safeState]})`,
        transition: STATE_TRANSITIONS[safeState],
        ...style,
      }}
      {...rest}
    >
      {sources.map((s, i) => (
        <source key={i} src={s.src} type={s.type || 'video/mp4'} />
      ))}
    </video>
  )
})

/**
 * AvatarRenderer-compatible class wrapper.
 *
 * This is the public API consumed by AvatarEngine / useAvatarRenderer.
 *
 * Quality goals for this implementation:
 *   - Two <video> elements are mounted and preloaded at all times.
 *   - Crossfade between idle and talking via CSS opacity (200ms) to avoid
 *     flicker or black frames.
 *   - The talking clip loops automatically while the speaking state is active.
 *   - The avatar is centered and its aspect ratio is preserved.
 *   - No continuous requestAnimationFrame loop, so CPU usage stays low.
 */
export default class VideoAvatarRenderer {
  #container = null
  #root = null
  #video = null
  #idleVideo = null
  #talkingVideo = null
  #frozenFrame = null
  #videoVisibilityHandler = null
  #idleVideoSrc = '/avatar/idle.mp4'
  #talkingVideoSrc = '/avatar/talking.mp4?v=20260706'
  #poster = ''
  #audioEl = null
  #currentOnFinished = null
  #settings = { voice: 'female', speed: 1, pitch: 1 }
  #avatarGender = 'female'
  #state = 'idle'
  #isPausedFrame = false
  #fadeDuration = 200

  constructor(options = {}) {
    this.#idleVideoSrc = options.idleVideo || '/avatar/idle.mp4'
    this.#talkingVideoSrc = options.talkingVideo || '/avatar/talking.mp4?v=20260706'
    this.#poster = options.poster || ''
    this.#fadeDuration = Math.min(200, Math.max(150, Number(options.fadeDuration) || 200))
  }

  #createVideoElement(src, { opacity = 1, pointerEvents = 'auto' } = {}) {
    const el = document.createElement('video')
    el.src = src
    el.poster = this.#poster
    el.autoplay = true
    el.muted = true
    el.loop = true
    el.playsInline = true
    el.preload = 'auto'
    el.disablePictureInPicture = true
    el.disableRemotePlayback = true
    el.dataset.avatarState = this.#state
    el.style.cssText = `
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      object-position: center center;
      display: block;
      opacity: ${opacity};
      pointer-events: ${pointerEvents};
      transition: opacity ${this.#fadeDuration}ms ease-in-out;
      will-change: opacity;
      background: #0a0a0a;
    `
    return el
  }

  #playVideo(video) {
    if (!video) return
    const p = video.play()
    if (p && typeof p.catch === 'function') p.catch(() => {})
  }

  #pauseVideo(video) {
    if (!video) return
    try { video.pause() } catch {}
  }

  #captureFrozenFrame() {
    if (!this.#video || !this.#frozenFrame) return
    try {
      const canvas = this.#frozenFrame
      const width = this.#video.videoWidth || this.#video.clientWidth || 640
      const height = this.#video.videoHeight || this.#video.clientHeight || 360
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      const ctx = canvas.getContext('2d', { alpha: false })
      ctx.drawImage(this.#video, 0, 0, width, height)
      this.#frozenFrame.style.opacity = '1'
      this.#isPausedFrame = true
    } catch {
      // Canvas drawImage can fail cross-origin; ignore safely.
    }
  }

  #hideFrozenFrame() {
    if (!this.#frozenFrame) return
    this.#frozenFrame.style.opacity = '0'
    this.#isPausedFrame = false
  }


  #switchToTalking() {
    if (!this.#idleVideo || !this.#talkingVideo) return

    // Only reset the clip if it isn't already playing; otherwise we avoid a
    // visible frame jump when toggling between states.
    if (this.#talkingVideo.paused || this.#talkingVideo.currentTime === 0) {
      this.#talkingVideo.currentTime = 0
    }
    this.#playVideo(this.#talkingVideo)

    this.#talkingVideo.style.opacity = '1'
    this.#talkingVideo.style.pointerEvents = 'auto'
    this.#idleVideo.style.opacity = '0'
    this.#idleVideo.style.pointerEvents = 'none'
    this.#video = this.#talkingVideo
  }

  #switchToIdle() {
    if (!this.#idleVideo || !this.#talkingVideo) return

    // Do not force the idle video to restart; let its loop continue naturally.
    this.#pauseVideo(this.#talkingVideo)
    this.#talkingVideo.currentTime = 0
    this.#talkingVideo.style.opacity = '0'
    this.#talkingVideo.style.pointerEvents = 'none'
    this.#idleVideo.style.opacity = '1'
    this.#idleVideo.style.pointerEvents = 'auto'
    this.#video = this.#idleVideo

    // Ensure idle stays looping; we don't reset currentTime so the loop feels continuous.
    this.#playVideo(this.#idleVideo)
  }

  #applyState(state) {
    if (!this.#idleVideo || !this.#talkingVideo) return

    // Both videos share identical scale/filter so there is no visible change
    // other than the crossfade between the two clips.
    ;[this.#idleVideo, this.#talkingVideo].forEach((v) => {
      v.dataset.avatarState = state
      v.style.filter = STATE_FILTERS[state] || 'none'
      v.style.transform = `scale(${STATE_SCALES[state] ?? 1})`
    })

    // Keep idle video looping for all non-speaking states. Avoid touching the
    // idle play state if it is already playing to prevent stutter.
    if (this.#idleVideo.paused) {
      this.#playVideo(this.#idleVideo)
    }
    this.#idleVideo.style.opacity = '1'
    this.#idleVideo.style.pointerEvents = 'auto'

    if (state === 'speaking') {
      this.#switchToTalking()
      return
    }

    // Not speaking: ensure only the idle layer is visible.
    if (this.#video !== this.#idleVideo) {
      this.#switchToIdle()
    }
  }

  mount(container) {
    this.destroy()
    this.#container = container
    container.innerHTML = ''

    const wrapper = document.createElement('div')
    wrapper.style.cssText = `
      width: 100%;
      height: 100%;
      position: relative;
      overflow: hidden;
      border-radius: 16px;
      background: #0a0a0a;
      display: flex;
      align-items: center;
      justify-content: center;
    `

    // Idle video is the visible/active layer initially. Talking video is
    // preloaded and kept ready for a smooth crossfade.
    const idleVideo = this.#createVideoElement(this.#idleVideoSrc, { opacity: 1, pointerEvents: 'auto' })
    const talkingVideo = this.#createVideoElement(this.#talkingVideoSrc, { opacity: 0, pointerEvents: 'none' })

    // Preload both videos so the first switch is instant.
    idleVideo.load()
    talkingVideo.load()

    // Keep idle playing immediately. Talking stays paused until speaking starts
    // so it does not waste decoder resources in the background.
    this.#playVideo(idleVideo)
    this.#pauseVideo(talkingVideo)

    // Remove unused frozen-frame canvas; it is no longer part of the desired UX.
    const frozenFrame = document.createElement('canvas')
    frozenFrame.className = 'video-avatar-frozen-frame'
    frozenFrame.style.cssText = `
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      object-position: center;
      display: block;
      opacity: 0;
      transition: opacity 0.35s ease;
      z-index: 1;
      pointer-events: none;
    `

    // Keep idle alive even if a play() promise is rejected; talking is left
    // paused until the speaking state explicitly starts it.
    idleVideo.oncanplay = () => {
      this.#playVideo(idleVideo)
    }
    talkingVideo.oncanplay = () => {
      // Do not auto-play; it will be started on demand in #switchToTalking().
    }

    const handleVisibility = () => {
      if (document.hidden) {
        this.#pauseVideo(this.#idleVideo)
        this.#pauseVideo(this.#talkingVideo)
      } else {
        this.#playVideo(this.#idleVideo)
        // Leave talking paused; #switchToTalking will resume it when needed.
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // Stacking order: frozen frame < talking video < idle video.
    // Idle starts on top because it is the initially visible layer.
    wrapper.appendChild(frozenFrame)
    wrapper.appendChild(talkingVideo)
    wrapper.appendChild(idleVideo)
    container.appendChild(wrapper)

    this.#root = wrapper
    this.#video = idleVideo
    this.#idleVideo = idleVideo
    this.#talkingVideo = talkingVideo
    this.#frozenFrame = frozenFrame
    this.#videoVisibilityHandler = handleVisibility
    this.#applyState(this.#state)
  }

  render(state, portrait) {
    if (!VALID_STATES.includes(state)) return
    this.#state = state
    this.#applyState(state)
    if (this.#container) {
      this.#container.dataset.avatarState = state
    }
  }

  setPreset(preset) {
    if (preset?.portrait && this.#poster !== preset.portrait) {
      this.#poster = preset.portrait
    }
    if (preset?.gender && this.#avatarGender !== preset.gender) {
      this.#avatarGender = preset.gender
    }
  }

  playAudio(audio) {
    const src = typeof audio === 'string' ? audio : audio?.url || audio?.src
    if (src) {
      this.stopAudio()
      if (!this.#audioEl) {
        this.#audioEl = document.createElement('audio')
        this.#audioEl.style.display = 'none'
      }
      this.#currentOnFinished = audio?.onFinished
      this.#audioEl.onended = () => {
        if (typeof this.#currentOnFinished === 'function') {
          this.#currentOnFinished()
        }
      }
      this.#audioEl.onerror = () => {
        if (typeof this.#currentOnFinished === 'function') {
          this.#currentOnFinished()
        }
      }
      this.#audioEl.src = src
      this.#audioEl.play().catch(() => {})
      return
    }

    const text = typeof audio === 'string' ? '' : audio?.text
    if (!text) return

    this.stopAudio()
    const synth = window.speechSynthesis
    const speed = audio?.speed ?? this.#settings.speed ?? 1
    const pitch = audio?.pitch ?? this.#settings.pitch ?? 1
    const voiceKey = audio?.voice || this.#settings.voice || this.#avatarGender || 'female'
    this.#settings = { voice: voiceKey, speed, pitch }

    const preferredLanguage = 'en-US'
    const pickVoice = (voices, gender) => {
      // Gender-specific name heuristics.
      const femalePatterns = /zira|jenny|linda|samantha|victoria|anna|hazel|susan|mary|karen|tessa|moira|fiona|veena|lesya|female|woman/gi
      const malePatterns = /david|mark|james|alex|daniel|george|richard|tony|paul|ryan|john|male|man/gi

      const isFemale = name => femalePatterns.test(name)
      const isMale = name => malePatterns.test(name)

      let candidates = []
      if (gender === 'female') {
        candidates = voices.filter(v => isFemale(v.name.toLowerCase()))
      } else if (gender === 'male') {
        candidates = voices.filter(v => isMale(v.name.toLowerCase()))
      }
      // Fallback: any voice that does not contradict the requested gender.
      if (!candidates.length) {
        if (gender === 'female') {
          candidates = voices.filter(v => !isMale(v.name.toLowerCase()))
        } else if (gender === 'male') {
          candidates = voices.filter(v => !isFemale(v.name.toLowerCase()))
        }
      }
      // Last resort: all voices.
      if (!candidates.length) candidates = [...voices]

      // Prefer requested language and default/local voices, then sort by quality.
      candidates.sort((a, b) => {
        const aLang = a.lang?.toLowerCase().startsWith(preferredLanguage.toLowerCase()) ? 1 : 0
        const bLang = b.lang?.toLowerCase().startsWith(preferredLanguage.toLowerCase()) ? 1 : 0
        if (aLang !== bLang) return bLang - aLang
        const aDefault = a.default ? 1 : 0
        const bDefault = b.default ? 1 : 0
        if (aDefault !== bDefault) return bDefault - aDefault
        const aLocal = a.localService ? 1 : 0
        const bLocal = b.localService ? 1 : 0
        return bLocal - aLocal
      })

      return candidates[0] || null
    }

    const detectedGender = ['male', 'female'].includes(voiceKey.toLowerCase()) ? voiceKey.toLowerCase() : this.#avatarGender

    // Ensure voices are loaded; in some browsers getVoices() is empty until the
    // voiceschanged event fires, so defer speaking if necessary.
    let voices = synth?.getVoices() || []
    const speakWithVoices = () => {
      const utter = new SpeechSynthesisUtterance(text)
      utter.rate = speed
      utter.pitch = pitch
      utter.volume = 1

      voices = synth.getVoices() || []
      const chosen = voices.length ? pickVoice(voices, detectedGender) : null
      if (chosen) utter.voice = chosen

      const genderLabel = ['male', 'female'].includes(detectedGender) ? detectedGender : 'unknown'
      console.log('[SpeechSynthesis] voice selection:', {
        selected: chosen?.name || 'default (browser fallback)',
        gender: genderLabel,
        lang: chosen?.lang || navigator.language,
        totalVoices: voices.length,
      })

      utter.onstart = () => {
        console.log('[SpeechSynthesis] onstart fired:', text.slice(0, 40))
        if (typeof audio?.onStarted === 'function') audio.onStarted()
      }
      utter.onend = () => {
        console.log('[SpeechSynthesis] onend fired')
        if (typeof audio?.onFinished === 'function') audio.onFinished()
      }
      utter.onerror = (e) => {
        console.error('[SpeechSynthesis] onerror:', e.error, e.message)
        if (typeof audio?.onFinished === 'function') audio.onFinished()
      }

      console.log('[SpeechSynthesis] invoking synth.speak() with', {
        text: text.slice(0, 40),
        voiceKey,
        chosenVoice: chosen?.name,
        rate: speed,
        pitch,
        volume: utter.volume,
        voiceCount: voices.length,
      })

      synth?.speak(utter)
    }

    if (!voices.length && synth) {
      const onVoicesChanged = () => {
        synth.removeEventListener('voiceschanged', onVoicesChanged)
        speakWithVoices()
      }
      synth.addEventListener('voiceschanged', onVoicesChanged)
      // Fallback: some browsers do not fire voiceschanged when voices are already
      // loaded. Try speaking after a short delay anyway.
      setTimeout(() => {
        synth.removeEventListener('voiceschanged', onVoicesChanged)
        speakWithVoices()
      }, 200)
      return
    }

    speakWithVoices()
  }

  stopAudio() {
    if (this.#audioEl) {
      this.#audioEl.pause()
      this.#audioEl.src = ''
      this.#audioEl.onended = null
      this.#audioEl.onerror = null
    }
    try { window.speechSynthesis?.cancel() } catch {
      // Speech synthesis cancellation may throw in some browsers; safe to ignore.
    }
  }

  destroy() {
    this.stopAudio()
    if (this.#videoVisibilityHandler) {
      document.removeEventListener('visibilitychange', this.#videoVisibilityHandler)
      this.#videoVisibilityHandler = null
    }
    if (this.#container) {
      this.#container.innerHTML = ''
    }
    this.#container = null
    this.#root = null
    this.#video = null
    this.#idleVideo = null
    this.#talkingVideo = null
    this.#frozenFrame = null
  }
}
export { VideoAvatar }
