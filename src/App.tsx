/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  Volume2,
  Clock,
  Mic,
  Activity,
  Layers,
  ChevronRight,
  Info,
  Radio,
  Send
} from 'lucide-react';
import {
  CallStatus,
  InputMode,
  AudioEngine,
  MessageItem,
  PERSONAS,
  GEMINI_VOICES
} from './types.ts';
import { audioManager } from './audio/audioManager.ts';
import { AudioWaveform } from './components/AudioWaveform.tsx';
import { CallControls } from './components/CallControls.tsx';
import { TranscriptDrawer } from './components/TranscriptDrawer.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';
import { VercelGuideModal } from './components/VercelGuideModal.tsx';

export default function App() {
  // Call status & timing
  const [status, setStatus] = useState<CallStatus>('idle');
  const [callDuration, setCallDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [userVolume, setUserVolume] = useState<number>(0);
  const [micError, setMicError] = useState<string | null>(null);

  // Subtitles & history
  const [currentSubtitle, setCurrentSubtitle] = useState<{ speaker: 'user' | 'model'; text: string } | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>(() => {
    try {
      const saved = localStorage.getItem('gemini_call_transcript');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Settings
  const [selectedVoice, setSelectedVoice] = useState<string>(() => {
    return localStorage.getItem('gemini_voice') || 'Kore';
  });
  const [audioEngine, setAudioEngine] = useState<AudioEngine>(() => {
    return (localStorage.getItem('gemini_audio_engine') as AudioEngine) || 'gemini_tts';
  });
  const [inputMode, setInputMode] = useState<InputMode>(() => {
    return (localStorage.getItem('gemini_input_mode') as InputMode) || 'auto';
  });
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(() => {
    return localStorage.getItem('gemini_persona_id') || 'companion';
  });
  const [customSystemPrompt, setCustomSystemPrompt] = useState<string>(() => {
    return localStorage.getItem('gemini_custom_prompt') || PERSONAS[0].systemPrompt;
  });
  const [silenceDelayMs, setSilenceDelayMs] = useState<number>(() => {
    const val = localStorage.getItem('gemini_silence_delay');
    return val ? parseInt(val, 10) : 900;
  });

  // Modals & UI states
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isVercelGuideOpen, setIsVercelGuideOpen] = useState(false);
  const [isPushTalking, setIsPushTalking] = useState(false);
  const [hasSpeechText, setHasSpeechText] = useState(false);

  // References
  const timerRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const speechAccumulatorRef = useRef<string>('');
  const silenceDebounceTimerRef = useRef<number | null>(null);
  const statusRef = useRef<CallStatus>(status);
  const messagesRef = useRef<MessageItem[]>(messages);
  const isMutedRef = useRef<boolean>(isMuted);
  const isSendingTurnRef = useRef<boolean>(false);

  // Keep refs up to date
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    messagesRef.current = messages;
    try {
      localStorage.setItem('gemini_call_transcript', JSON.stringify(messages));
    } catch {}
  }, [messages]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    audioManager.setSilenceDelay(silenceDelayMs);
  }, [silenceDelayMs]);

  // Persist settings
  useEffect(() => {
    localStorage.setItem('gemini_voice', selectedVoice);
  }, [selectedVoice]);

  useEffect(() => {
    localStorage.setItem('gemini_audio_engine', audioEngine);
  }, [audioEngine]);

  useEffect(() => {
    localStorage.setItem('gemini_input_mode', inputMode);
  }, [inputMode]);

  useEffect(() => {
    localStorage.setItem('gemini_persona_id', selectedPersonaId);
  }, [selectedPersonaId]);

  useEffect(() => {
    localStorage.setItem('gemini_custom_prompt', customSystemPrompt);
  }, [customSystemPrompt]);

  useEffect(() => {
    localStorage.setItem('gemini_silence_delay', String(silenceDelayMs));
  }, [silenceDelayMs]);

  // Call duration timer
  useEffect(() => {
    if (status !== 'idle' && status !== 'ended') {
      if (!timerRef.current) {
        timerRef.current = window.setInterval(() => {
          setCallDuration((prev) => prev + 1);
        }, 1000);
      }
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (status === 'idle') {
        setCallDuration(0);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status]);

  // Setup AudioManager callbacks
  useEffect(() => {
    audioManager.onVolumeUpdate = (volume) => {
      setUserVolume(volume);
    };

    audioManager.onPlaybackEnd = () => {
      if (statusRef.current === 'speaking') {
        setStatus('listening');
        setCurrentSubtitle(null);
        startListeningTurn();
      }
    };

    return () => {
      audioManager.onVolumeUpdate = undefined;
      audioManager.onPlaybackEnd = undefined;
      audioManager.onSilenceDetected = undefined;
    };
  }, []);

  // Format call duration MM:SS
  const formatDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // --- Send turn to Serverless Gemini Backend ---
  const sendTurnToGemini = async (userText: string, audioBase64?: string) => {
    if (isSendingTurnRef.current || statusRef.current === 'ended') return;
    if (!userText && !audioBase64) return;

    isSendingTurnRef.current = true;
    setHasSpeechText(false);

    if (silenceDebounceTimerRef.current) {
      clearTimeout(silenceDebounceTimerRef.current);
      silenceDebounceTimerRef.current = null;
    }

    setStatus('processing');
    setCurrentSubtitle({ speaker: 'user', text: userText || 'Procesando tu voz...' });

    // Add user message to history
    const userMessage: MessageItem = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: userText || 'Mensaje de voz',
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const historyPayload = messagesRef.current.slice(-6).map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const response = await fetch('/api/call-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userText,
          audioBase64,
          history: historyPayload,
          systemInstruction: customSystemPrompt,
          voice: selectedVoice,
        }),
      });

      if (!response.ok) {
        throw new Error(`Error en el servidor: ${response.statusText}`);
      }

      const data = await response.json();

      const replyText = data.replyText || 'Te escucho.';
      const audioOutput = data.audioBase64;
      const latencyMs = data.latencyMs;

      // Add Gemini response to history
      const geminiMessage: MessageItem = {
        id: `gemini-${Date.now()}`,
        role: 'model',
        text: replyText,
        timestamp: Date.now(),
        audioBase64: audioOutput,
        latencyMs,
      };
      setMessages((prev) => [...prev, geminiMessage]);

      // Set speaking state
      setStatus('speaking');
      setCurrentSubtitle({ speaker: 'model', text: replyText });

      // Play audio response
      if (audioEngine === 'gemini_tts' && audioOutput) {
        try {
          await audioManager.playBase64Wav(audioOutput);
        } catch (audioErr) {
          console.warn('Fallback to browser speech on error:', audioErr);
          await audioManager.speakBrowser(replyText);
        }
      } else {
        await audioManager.speakBrowser(replyText);
      }
    } catch (error: any) {
      console.error('Call turn error:', error);
      setCurrentSubtitle({
        speaker: 'model',
        text: 'Hubo un error momentáneo de conexión con Gemini. Volviendo a escuchar...',
      });
      setTimeout(() => {
        if (statusRef.current !== 'ended') {
          setStatus('listening');
          startListeningTurn();
        }
      }, 2000);
    } finally {
      isSendingTurnRef.current = false;
    }
  };

  // Helper to trigger turn from current accumulated text or audio
  const triggerTurn = useCallback(async () => {
    if (isSendingTurnRef.current || statusRef.current !== 'listening') return;

    const recognizedText = speechAccumulatorRef.current.trim();

    // Stop speech recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }

    // Stop recording audio chunk
    const recorded = await audioManager.stopRecording();

    speechAccumulatorRef.current = '';
    setHasSpeechText(false);

    if (recognizedText) {
      sendTurnToGemini(recognizedText);
    } else if (recorded && recorded.base64) {
      sendTurnToGemini('', recorded.base64);
    }
  }, [customSystemPrompt, selectedVoice, audioEngine]);

  // --- Voice Activity Detection & Speech Recognition ---
  const startListeningTurn = useCallback(() => {
    if (statusRef.current === 'ended' || isMutedRef.current) return;

    speechAccumulatorRef.current = '';
    setHasSpeechText(false);

    if (silenceDebounceTimerRef.current) {
      clearTimeout(silenceDebounceTimerRef.current);
      silenceDebounceTimerRef.current = null;
    }

    // Check for browser SpeechRecognition
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.abort();
          } catch {}
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'es-ES';

        recognition.onresult = (event: any) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              speechAccumulatorRef.current += ' ' + event.results[i][0].transcript;
            } else {
              interim += event.results[i][0].transcript;
            }
          }
          const fullText = (speechAccumulatorRef.current + ' ' + interim).trim();
          if (fullText) {
            setHasSpeechText(true);
            setCurrentSubtitle({ speaker: 'user', text: fullText });
            audioManager.markSpeechDetectedManually();

            // Auto-send debounce: on mobile, if the user pauses for 850ms, send automatically!
            if (inputMode === 'auto') {
              if (silenceDebounceTimerRef.current) {
                clearTimeout(silenceDebounceTimerRef.current);
              }
              silenceDebounceTimerRef.current = window.setTimeout(() => {
                if (speechAccumulatorRef.current.trim().length > 1) {
                  triggerTurn();
                }
              }, Math.max(750, silenceDelayMs));
            }
          }
        };

        recognition.onspeechend = () => {
          // On mobile Android/Chrome, speech ended
          if (inputMode === 'auto' && speechAccumulatorRef.current.trim().length > 1) {
            setTimeout(() => {
              triggerTurn();
            }, 300);
          }
        };

        recognition.onerror = (e: any) => {
          if (e.error !== 'no-speech') {
            console.warn('SpeechRecognition warning:', e.error);
          }
        };

        recognition.onend = () => {
          // If we had speech that hasn't been sent yet, send it now!
          if (statusRef.current === 'listening' && speechAccumulatorRef.current.trim().length > 1) {
            triggerTurn();
            return;
          }

          // Otherwise keep listening if call still active
          if (statusRef.current === 'listening' && !isMutedRef.current) {
            try {
              recognition.start();
            } catch {}
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch (err) {
        console.warn('SpeechRecognition init:', err);
      }
    }

    // Start MediaRecorder for audio recording fallback
    audioManager.startRecording();
    audioManager.resetVADState();

    // VAD silence trigger callback
    audioManager.onSilenceDetected = async () => {
      if (statusRef.current !== 'listening' || isMutedRef.current) return;
      triggerTurn();
    };
  }, [selectedVoice, customSystemPrompt, audioEngine, inputMode, silenceDelayMs, triggerTurn]);

  // --- Start Call ---
  const handleStartCall = async () => {
    try {
      setMicError(null);
      setStatus('connecting');

      // Crucial: Unlock audio output on touch gesture for iOS Safari & Android
      audioManager.primeAudioPlayback();
      audioManager.playConnectChime();

      // Acquire microphone
      try {
        await audioManager.startMicrophone();
      } catch (micErr: any) {
        console.warn('Microphone start error:', micErr);
        setMicError(
          'No se pudo activar el micrófono automáticamente (puede deberse a permisos del navegador o falta de micrófono). Puedes usar los botones de "Pruebas rápidas" o escribir por teclado y escucharás la voz de Gemini.'
        );
      }

      setStatus('listening');
      startListeningTurn();
    } catch (err: any) {
      console.error('Failed to start call:', err);
      setMicError('Error al iniciar llamada. Revisa los permisos de audio en tu navegador.');
      setStatus('listening');
      startListeningTurn();
    }
  };

  // --- End Call ---
  const handleEndCall = () => {
    setStatus('ended');
    audioManager.playHangupChime();
    audioManager.stopPlayback();
    audioManager.stopMicrophone();

    if (silenceDebounceTimerRef.current) {
      clearTimeout(silenceDebounceTimerRef.current);
      silenceDebounceTimerRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }

    setTimeout(() => {
      setStatus('idle');
      setCurrentSubtitle(null);
      setHasSpeechText(false);
    }, 1200);
  };

  // --- Toggle Mute ---
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (nextMuted) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    } else {
      if (status === 'listening') {
        startListeningTurn();
      }
    }
  };

  // --- Interrupt Gemini ---
  const handleInterrupt = () => {
    audioManager.stopPlayback();
    setStatus('listening');
    setCurrentSubtitle(null);
    startListeningTurn();
  };

  // --- Push to Talk Handlers ---
  const handlePushToTalkDown = () => {
    if (status !== 'listening') return;
    setIsPushTalking(true);
    speechAccumulatorRef.current = '';
    audioManager.startRecording();
  };

  const handlePushToTalkUp = async () => {
    if (!isPushTalking) return;
    setIsPushTalking(false);
    triggerTurn();
  };

  // Quick Prompt test handler (especially useful on Desktop or when testing)
  const handleQuickPrompt = (prompt: string) => {
    audioManager.primeAudioPlayback();
    if (status === 'idle') {
      setStatus('connecting');
      audioManager.playConnectChime();
      setTimeout(() => {
        sendTurnToGemini(prompt);
      }, 500);
    } else {
      sendTurnToGemini(prompt);
    }
  };

  // Clear messages
  const handleClearTranscript = () => {
    setMessages([]);
    localStorage.removeItem('gemini_call_transcript');
  };

  const currentPersona = PERSONAS.find((p) => p.id === selectedPersonaId) || PERSONAS[0];
  const isCallActive = status !== 'idle' && status !== 'ended';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white font-sans antialiased overflow-x-hidden">
      {/* Top Navigation Bar */}
      <header className="w-full max-w-4xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between border-b border-slate-900/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-100">
                Gemini Live Call
              </h1>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800/60">
                v3.8 Flash SDK
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Llamada de voz bidireccional en tiempo real con servidor proxy
            </p>
          </div>
        </div>

        {/* Status & Call Timer Pill */}
        <div className="flex items-center gap-2">
          {isCallActive ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-mono font-semibold text-emerald-400">{formatDuration(callDuration)}</span>
            </div>
          ) : (
            <button
              onClick={() => setIsVercelGuideOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-850 border border-slate-800 text-xs text-slate-300 transition-colors cursor-pointer"
            >
              <Info className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Arquitectura Vercel</span>
              <span className="sm:hidden">Info</span>
            </button>
          )}

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-850 border border-slate-800 text-xs text-slate-300 transition-colors cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5 text-purple-400" />
            <span className="font-medium text-slate-200">{selectedVoice}</span>
          </button>
        </div>
      </header>

      {/* Main Call Viewport */}
      <main className="flex-1 flex flex-col items-center justify-center max-w-2xl w-full mx-auto px-4 py-2 relative">
        {/* Active persona banner */}
        <div className="mb-2 flex items-center gap-2 text-xs text-slate-400 bg-slate-900/60 border border-slate-800/80 px-3.5 py-1 rounded-full">
          <span className="text-indigo-400 font-medium">Modo:</span>
          <span>{currentPersona.name}</span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400">
            {inputMode === 'auto' ? 'Manos Libres (Auto)' : 'Pulsar para hablar'}
          </span>
        </div>

        {/* Call Waveform & Reactive Orb */}
        <AudioWaveform
          status={status}
          userVolume={userVolume}
          isMuted={isMuted}
        />

        {/* Live Subtitle / Teleprompter Bubble */}
        <div className="w-full max-w-lg min-h-[68px] flex items-center justify-center text-center px-4 mb-2">
          {currentSubtitle ? (
            <div className={`px-4 py-2 rounded-2xl max-w-full text-sm leading-relaxed backdrop-blur-md shadow-lg transition-all animate-fade-in ${
              currentSubtitle.speaker === 'user'
                ? 'bg-sky-950/70 border border-sky-800/60 text-sky-200'
                : 'bg-purple-950/70 border border-purple-800/60 text-purple-200'
            }`}>
              <div className="text-[10px] uppercase tracking-wider font-bold mb-0.5 opacity-75">
                {currentSubtitle.speaker === 'user' ? 'Tú (Detectado)' : 'Gemini'}
              </div>
              <p className="line-clamp-3">{currentSubtitle.text}</p>
            </div>
          ) : (
            <div className="text-xs text-slate-500 italic">
              {isCallActive
                ? status === 'listening'
                  ? 'Escuchándote... Habla ahora y Gemini responderá.'
                  : 'Procesando llamada...'
                : 'Pulsa el botón "INICIAR LLAMADA" para comenzar.'}
            </div>
          )}
        </div>
      </main>

      {/* Bottom Phone Controls */}
      <footer className="w-full">
        <CallControls
          status={status}
          isMuted={isMuted}
          inputMode={inputMode}
          micError={micError}
          hasSpeechText={hasSpeechText}
          onStartCall={handleStartCall}
          onEndCall={handleEndCall}
          onToggleMute={handleToggleMute}
          onInterrupt={handleInterrupt}
          onSendNow={triggerTurn}
          onQuickPrompt={handleQuickPrompt}
          onToggleSettings={() => setIsSettingsOpen(true)}
          onToggleTranscript={() => setIsTranscriptOpen(true)}
          onOpenVercelGuide={() => setIsVercelGuideOpen(true)}
          onPushToTalkDown={handlePushToTalkDown}
          onPushToTalkUp={handlePushToTalkUp}
          isPushTalking={isPushTalking}
        />
      </footer>

      {/* Transcript Drawer */}
      <TranscriptDrawer
        isOpen={isTranscriptOpen}
        onClose={() => setIsTranscriptOpen(false)}
        messages={messages}
        onClear={handleClearTranscript}
        onSendMessage={(text) => {
          handleQuickPrompt(text);
        }}
        isProcessing={status === 'processing'}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        selectedVoice={selectedVoice}
        onChangeVoice={setSelectedVoice}
        audioEngine={audioEngine}
        onChangeAudioEngine={setAudioEngine}
        inputMode={inputMode}
        onChangeInputMode={setInputMode}
        selectedPersonaId={selectedPersonaId}
        onChangePersona={setSelectedPersonaId}
        customSystemPrompt={customSystemPrompt}
        onChangeCustomPrompt={setCustomSystemPrompt}
        silenceDelayMs={silenceDelayMs}
        onChangeSilenceDelay={setSilenceDelayMs}
      />

      {/* Vercel Guide Modal */}
      <VercelGuideModal
        isOpen={isVercelGuideOpen}
        onClose={() => setIsVercelGuideOpen(false)}
      />
    </div>
  );
}
