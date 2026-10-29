/**
 * Audio Manager: Web Audio synthesis, visualizer analyser, audio playback,
 * silence detection (VAD), and speech recognition helpers.
 */

class AudioManager {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  // Playback state
  private currentAudioElement: HTMLAudioElement | null = null;
  private currentSourceNode: AudioBufferSourceNode | null = null;
  private isPlaying = false;

  // Silence detection
  private vadInterval: number | null = null;
  private speechDetected = false;
  private silenceStartTime: number | null = null;
  private silenceThreshold = 0.025; // RMS threshold
  private silenceDurationMs = 1200; // Time in silence before triggering turn

  public onSilenceDetected?: () => void;
  public onVolumeUpdate?: (volume: number) => void;
  public onPlaybackEnd?: () => void;

  public getAudioContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
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
        osc.frequency.setValueAtTime(freq, now + i * 0.08);

        gain.gain.setValueAtTime(0, now + i * 0.08);
        gain.gain.linearRampToValueAtTime(0.15, now + i * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.36);
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
        osc.frequency.setValueAtTime(freq, now + i * 0.14);

        gain.gain.setValueAtTime(0.12, now + i * 0.14);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.14 + 0.2);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.14);
        osc.stop(now + i * 0.14 + 0.22);
      });
    } catch (e) {
      console.warn('Audio hangup error:', e);
    }
  }

  // --- Microphone & Analyser ---

  public async startMicrophone(): Promise<MediaStream> {
    if (this.micStream) {
      return this.micStream;
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
    this.analyser.smoothingTimeConstant = 0.8;

    this.micSource = ctx.createMediaStreamSource(stream);
    this.micSource.connect(this.analyser);

    this.startVAD();
    return stream;
  }

  public stopMicrophone() {
    this.stopVAD();
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
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

  // --- Voice Activity Detection (VAD) ---

  private startVAD() {
    this.stopVAD();
    const dataArray = new Uint8Array(128);

    this.vadInterval = window.setInterval(() => {
      if (!this.analyser || this.isPlaying) {
        // Don't detect silence while Gemini is speaking
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

      if (this.onVolumeUpdate) {
        this.onVolumeUpdate(rms);
      }

      // Voice activity logic
      if (rms > this.silenceThreshold) {
        this.speechDetected = true;
        this.silenceStartTime = null;
      } else if (this.speechDetected) {
        // User was speaking, now dropped into silence
        const now = Date.now();
        if (this.silenceStartTime === null) {
          this.silenceStartTime = now;
        } else if (now - this.silenceStartTime >= this.silenceDurationMs) {
          // Silence duration met
          this.speechDetected = false;
          this.silenceStartTime = null;
          if (this.onSilenceDetected) {
            this.onSilenceDetected();
          }
        }
      }
    }, 80);
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

  // --- MediaRecorder for Audio Blob capture ---

  public startRecording() {
    if (!this.micStream) return;
    this.recordedChunks = [];
    try {
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      this.mediaRecorder = new MediaRecorder(this.micStream, { mimeType });
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };
      this.mediaRecorder.start(250);
    } catch (e) {
      console.warn('MediaRecorder error:', e);
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

        // Convert blob to base64
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

  // --- Playback (Gemini TTS Audio) ---

  public async playBase64Wav(base64: string): Promise<void> {
    this.stopPlayback();
    this.isPlaying = true;

    return new Promise((resolve, reject) => {
      try {
        const audioSrc = `data:audio/wav;base64,${base64}`;
        const audio = new Audio(audioSrc);
        this.currentAudioElement = audio;

        audio.onended = () => {
          this.isPlaying = false;
          this.currentAudioElement = null;
          if (this.onPlaybackEnd) this.onPlaybackEnd();
          resolve();
        };

        audio.onerror = (e) => {
          this.isPlaying = false;
          this.currentAudioElement = null;
          if (this.onPlaybackEnd) this.onPlaybackEnd();
          reject(e);
        };

        audio.play().catch((err) => {
          this.isPlaying = false;
          this.currentAudioElement = null;
          if (this.onPlaybackEnd) this.onPlaybackEnd();
          reject(err);
        });
      } catch (err) {
        this.isPlaying = false;
        if (this.onPlaybackEnd) this.onPlaybackEnd();
        reject(err);
      }
    });
  }

  public stopPlayback() {
    if (this.currentAudioElement) {
      try {
        this.currentAudioElement.pause();
        this.currentAudioElement.currentTime = 0;
      } catch (_) {}
      this.currentAudioElement = null;
    }
    if (this.currentSourceNode) {
      try {
        this.currentSourceNode.stop();
      } catch (_) {}
      this.currentSourceNode = null;
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
        // Find a natural Spanish or English voice
        const preferred = voices.find((v) => v.lang.startsWith('es') || v.lang.startsWith('en'));
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
