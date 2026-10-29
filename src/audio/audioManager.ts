/**
 * Audio Manager: Web Audio synthesis, visualizer analyser, audio playback,
 * adaptive silence detection (VAD), iOS/Android audio unlocking, and speech helpers.
 */

class AudioManager {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  // Playback state & mobile audio unlocking
  private unlockedAudioElement: HTMLAudioElement | null = null;
  private isPlaying = false;
  private isAudioUnlocked = false;

  // Adaptive Silence Detection (VAD)
  private vadInterval: number | null = null;
  private speechDetected = false;
  private silenceStartTime: number | null = null;
  private silenceThreshold = 0.008; // Sensitive threshold for mobile and desktop mics
  private silenceDurationMs = 900; // Fast 900ms pause for natural conversational flow
  private noiseFloor = 0.003;

  public onSilenceDetected?: () => void;
  public onVolumeUpdate?: (volume: number) => void;
  public onPlaybackEnd?: () => void;

  public getAudioContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * Crucial for iOS Safari & Android: Unlocks the audio pipeline on direct user touch/click.
   */
  public primeAudioPlayback() {
    try {
      const ctx = this.getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      // Play a short silent buffer to unlock Web Audio on iOS
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);

      // Create and prime a reusable HTMLAudioElement with a silent data URI
      if (!this.unlockedAudioElement) {
        this.unlockedAudioElement = new Audio();
        // 1-sample silent wav data URI
        this.unlockedAudioElement.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
        this.unlockedAudioElement.load();
        this.unlockedAudioElement.play().then(() => {
          this.unlockedAudioElement?.pause();
          this.isAudioUnlocked = true;
        }).catch(() => {
          // Normal if browser requires another touch
        });
      }
    } catch (e) {
      console.warn('Audio unlock prime:', e);
    }
  }

  // --- Sound Effects ---

  public playConnectChime() {
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.07);

        gain.gain.setValueAtTime(0, now + i * 0.07);
        gain.gain.linearRampToValueAtTime(0.14, now + i * 0.07 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.07 + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.07);
        osc.stop(now + i * 0.07 + 0.32);
      });
    } catch (e) {
      console.warn('Audio chime error:', e);
    }
  }

  public playHangupChime() {
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;
      const notes = [659.25, 440.0]; // E5, A4
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.12);

        gain.gain.setValueAtTime(0.12, now + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.18);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.2);
      });
    } catch (e) {
      console.warn('Audio hangup error:', e);
    }
  }

  // --- Microphone & Analyser ---

  public async startMicrophone(): Promise<MediaStream> {
    if (this.micStream && this.micStream.active) {
      return this.micStream;
    }

    this.stopMicrophone();

    // Check if mediaDevices is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Tu navegador o dispositivo no soporta acceso al micrófono (mediaDevices no disponible).');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.micStream = stream;
    const ctx = this.getAudioContext();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.75;

    this.micSource = ctx.createMediaStreamSource(stream);
    this.micSource.connect(this.analyser);

    this.startVAD();
    return stream;
  }

  public stopMicrophone() {
    this.stopVAD();
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch (_) {}
      });
      this.micStream = null;
    }
    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch (_) {}
      this.micSource = null;
    }
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  // --- Adaptive Voice Activity Detection (VAD) ---

  public setSilenceDelay(ms: number) {
    this.silenceDurationMs = Math.max(500, ms);
  }

  private startVAD() {
    this.stopVAD();
    const dataArray = new Uint8Array(128);
    let sampleCount = 0;

    this.vadInterval = window.setInterval(() => {
      if (!this.analyser || this.isPlaying) {
        return;
      }

      this.analyser.getByteTimeDomainData(dataArray);

      // Compute RMS
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const val = (dataArray[i] - 128) / 128;
        sum += val * val;
      }
      const rms = Math.sqrt(sum / dataArray.length);

      // Dynamic noise floor calibration in the first 1-2 seconds
      sampleCount++;
      if (sampleCount < 20) {
        this.noiseFloor = (this.noiseFloor * 0.8) + (rms * 0.2);
        this.silenceThreshold = Math.max(0.007, this.noiseFloor * 2.0);
      }

      if (this.onVolumeUpdate) {
        this.onVolumeUpdate(rms);
      }

      // Voice activity logic
      if (rms > this.silenceThreshold) {
        this.speechDetected = true;
        this.silenceStartTime = null;
      } else if (this.speechDetected) {
        const now = Date.now();
        if (this.silenceStartTime === null) {
          this.silenceStartTime = now;
        } else if (now - this.silenceStartTime >= this.silenceDurationMs) {
          // Pause detected after speech
          this.speechDetected = false;
          this.silenceStartTime = null;
          if (this.onSilenceDetected) {
            this.onSilenceDetected();
          }
        }
      }
    }, 60);
  }

  private stopVAD() {
    if (this.vadInterval !== null) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }
    this.speechDetected = false;
    this.silenceStartTime = null;
  }

  public resetVADState() {
    this.speechDetected = false;
    this.silenceStartTime = null;
  }

  public markSpeechDetectedManually() {
    this.speechDetected = true;
    this.silenceStartTime = null;
  }

  // --- Robust Cross-Platform MediaRecorder (iOS Safari, Android, Desktop) ---

  private getBestMimeType(): string {
    if (typeof MediaRecorder === 'undefined') return '';
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/aac',
      'audio/ogg;codecs=opus',
      '',
    ];
    for (const c of candidates) {
      if (c === '' || MediaRecorder.isTypeSupported(c)) {
        return c;
      }
    }
    return '';
  }

  public startRecording() {
    if (!this.micStream) return;
    this.recordedChunks = [];
    try {
      const mimeType = this.getBestMimeType();
      const options = mimeType ? { mimeType } : undefined;
      this.mediaRecorder = new MediaRecorder(this.micStream, options);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      this.mediaRecorder.start(200);
    } catch (e) {
      console.warn('MediaRecorder init fallback:', e);
      try {
        // Fallback without options for older iOS / Android webviews
        this.mediaRecorder = new MediaRecorder(this.micStream);
        this.mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            this.recordedChunks.push(e.data);
          }
        };
        this.mediaRecorder.start(200);
      } catch (err) {
        console.warn('MediaRecorder failed completely:', err);
      }
    }
  }

  public async stopRecording(): Promise<{ blob: Blob; base64: string; mimeType: string } | null> {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      return null;
    }

    return new Promise((resolve) => {
      if (!this.mediaRecorder) return resolve(null);

      this.mediaRecorder.onstop = async () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        this.recordedChunks = [];

        if (blob.size === 0) {
          return resolve(null);
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1] || '';
          resolve({ blob, base64, mimeType });
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      };

      try {
        this.mediaRecorder.stop();
      } catch (e) {
        resolve(null);
      }
    });
  }

  // --- Reliable Audio Playback for Mobile & Desktop ---

  public async playBase64Wav(base64: string): Promise<void> {
    this.stopPlayback();
    this.isPlaying = true;

    return new Promise((resolve, reject) => {
      try {
        const audioSrc = `data:audio/wav;base64,${base64}`;

        // Use primed element if available, or create new
        const audio = this.unlockedAudioElement || new Audio();
        this.unlockedAudioElement = audio;
        audio.src = audioSrc;

        audio.onended = () => {
          this.isPlaying = false;
          if (this.onPlaybackEnd) this.onPlaybackEnd();
          resolve();
        };

        audio.onerror = (e) => {
          console.warn('Audio playback element error:', e);
          this.isPlaying = false;
          if (this.onPlaybackEnd) this.onPlaybackEnd();
          reject(e);
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn('Audio play() rejected by browser policy:', err);
            // Fallback to Web Speech if media element blocked
            this.isPlaying = false;
            if (this.onPlaybackEnd) this.onPlaybackEnd();
            reject(err);
          });
        }
      } catch (err) {
        this.isPlaying = false;
        if (this.onPlaybackEnd) this.onPlaybackEnd();
        reject(err);
      }
    });
  }

  public stopPlayback() {
    if (this.unlockedAudioElement) {
      try {
        this.unlockedAudioElement.pause();
        this.unlockedAudioElement.currentTime = 0;
      } catch (_) {}
    }
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    this.isPlaying = false;
  }

  public isAudioPlaying(): boolean {
    return this.isPlaying;
  }

  // --- Browser SpeechSynthesis Fallback ---

  public speakBrowser(text: string, voiceName?: string): Promise<void> {
    this.stopPlayback();
    this.isPlaying = true;

    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        this.isPlaying = false;
        if (this.onPlaybackEnd) this.onPlaybackEnd();
        resolve();
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-ES';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      if (voiceName) {
        const found = voices.find((v) => v.name.toLowerCase().includes(voiceName.toLowerCase()));
        if (found) utterance.voice = found;
      } else {
        const preferred = voices.find((v) => v.lang.startsWith('es'));
        if (preferred) utterance.voice = preferred;
      }

      utterance.onend = () => {
        this.isPlaying = false;
        if (this.onPlaybackEnd) this.onPlaybackEnd();
        resolve();
      };

      utterance.onerror = () => {
        this.isPlaying = false;
        if (this.onPlaybackEnd) this.onPlaybackEnd();
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }
}

export const audioManager = new AudioManager();
