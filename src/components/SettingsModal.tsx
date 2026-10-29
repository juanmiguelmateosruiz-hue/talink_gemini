import React, { useState } from 'react';
import {
  X,
  Volume2,
  Mic,
  Sparkles,
  Sliders,
  Play,
  RotateCcw,
  CheckCircle2
} from 'lucide-react';
import {
  AudioEngine,
  InputMode,
  GEMINI_VOICES,
  PERSONAS,
  PersonaOption,
  VoiceOption
} from '../types.ts';
import { audioManager } from '../audio/audioManager.ts';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVoice: string;
  onChangeVoice: (voice: string) => void;
  audioEngine: AudioEngine;
  onChangeAudioEngine: (engine: AudioEngine) => void;
  inputMode: InputMode;
  onChangeInputMode: (mode: InputMode) => void;
  selectedPersonaId: string;
  onChangePersona: (personaId: string) => void;
  customSystemPrompt: string;
  onChangeCustomPrompt: (prompt: string) => void;
  silenceDelayMs: number;
  onChangeSilenceDelay: (ms: number) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  selectedVoice,
  onChangeVoice,
  audioEngine,
  onChangeAudioEngine,
  inputMode,
  onChangeInputMode,
  selectedPersonaId,
  onChangePersona,
  customSystemPrompt,
  onChangeCustomPrompt,
  silenceDelayMs,
  onChangeSilenceDelay,
}) => {
  const [testingVoiceId, setTestingVoiceId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTestVoice = async (voice: VoiceOption) => {
    try {
      setTestingVoiceId(voice.id);
      if (audioEngine === 'gemini_tts') {
        const resp = await fetch('/api/speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `Hola, soy ${voice.name}. Encantado de hablar contigo.`,
            voice: voice.id,
          }),
        });
        const data = await resp.json();
        if (data.audioBase64) {
          await audioManager.playBase64Wav(data.audioBase64);
        }
      } else {
        await audioManager.speakBrowser(`Hola, soy la voz del navegador.`);
      }
    } catch (e) {
      console.warn('Voice preview error:', e);
    } finally {
      setTestingVoiceId(null);
    }
  };

  const currentPersona = PERSONAS.find((p) => p.id === selectedPersonaId) || PERSONAS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-slate-100">Configuración de Llamada</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
          {/* 1. Voice Selection */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <label className="font-semibold text-slate-200 flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-purple-400" />
                <span>Voz de Gemini (SDK Oficial Gemini 3.8)</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {GEMINI_VOICES.map((v) => {
                const isSelected = selectedVoice === v.id;
                const isTesting = testingVoiceId === v.id;
                return (
                  <div
                    key={v.id}
                    onClick={() => onChangeVoice(v.id)}
                    className={`cursor-pointer p-3 rounded-xl border transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-purple-950/40 border-purple-500/70 ring-1 ring-purple-500/50'
                        : 'bg-slate-850 border-slate-750 hover:border-slate-650'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-slate-100 flex items-center gap-1.5">
                          <span>{v.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                            {v.tone}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{v.description}</p>
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 ml-1" />}
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-800 flex justify-end">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTestVoice(v);
                        }}
                        disabled={isTesting}
                        className="text-xs flex items-center gap-1 text-slate-400 hover:text-purple-300 font-medium px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-800 transition-colors"
                      >
                        <Play className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />
                        <span>{isTesting ? 'Probando...' : 'Escuchar muestra'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 2. Audio Engine Selection */}
          <section>
            <label className="font-semibold text-slate-200 block mb-2">Motor de Síntesis de Voz</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onChangeAudioEngine('gemini_tts')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  audioEngine === 'gemini_tts'
                    ? 'bg-indigo-950/40 border-indigo-500/80 ring-1 ring-indigo-500/40'
                    : 'bg-slate-850 border-slate-750 hover:border-slate-650'
                }`}
              >
                <div className="font-medium text-slate-100 flex items-center justify-between">
                  <span>Gemini 3.8 Flash TTS</span>
                  {audioEngine === 'gemini_tts' && <CheckCircle2 className="w-4 h-4 text-indigo-400" />}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Audio WAV nativo de 24kHz. Expresividad y entonación hiperrealista.
                </p>
              </button>

              <button
                type="button"
                onClick={() => onChangeAudioEngine('browser_speech')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  audioEngine === 'browser_speech'
                    ? 'bg-indigo-950/40 border-indigo-500/80 ring-1 ring-indigo-500/40'
                    : 'bg-slate-850 border-slate-750 hover:border-slate-650'
                }`}
              >
                <div className="font-medium text-slate-100 flex items-center justify-between">
                  <span>Web Speech (Navegador)</span>
                  {audioEngine === 'browser_speech' && <CheckCircle2 className="w-4 h-4 text-indigo-400" />}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Síntesis local del navegador. Menor uso de datos, respuesta instantánea.
                </p>
              </button>
            </div>
          </section>

          {/* 3. Input Mode Selection */}
          <section>
            <label className="font-semibold text-slate-200 flex items-center gap-2 mb-2">
              <Mic className="w-4 h-4 text-sky-400" />
              <span>Modo de Interacción de Voz</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onChangeInputMode('auto')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  inputMode === 'auto'
                    ? 'bg-sky-950/40 border-sky-500/80 ring-1 ring-sky-500/40'
                    : 'bg-slate-850 border-slate-750 hover:border-slate-650'
                }`}
              >
                <div className="font-medium text-slate-100 flex items-center justify-between">
                  <span>Manos Libres (Llamada Real)</span>
                  {inputMode === 'auto' && <CheckCircle2 className="w-4 h-4 text-sky-400" />}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Detecta tu voz y las pausas automáticamente con VAD. No necesitas tocar nada.
                </p>
              </button>

              <button
                type="button"
                onClick={() => onChangeInputMode('push_to_talk')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  inputMode === 'push_to_talk'
                    ? 'bg-sky-950/40 border-sky-500/80 ring-1 ring-sky-500/40'
                    : 'bg-slate-850 border-slate-750 hover:border-slate-650'
                }`}
              >
                <div className="font-medium text-slate-100 flex items-center justify-between">
                  <span>Pulsar para Hablar</span>
                  {inputMode === 'push_to_talk' && <CheckCircle2 className="w-4 h-4 text-sky-400" />}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Mantén pulsado para hablar y suelta cuando termines. Ideal para entornos ruidosos.
                </p>
              </button>
            </div>

            {inputMode === 'auto' && (
              <div className="mt-3 p-3 bg-slate-800/60 rounded-xl border border-slate-750">
                <div className="flex justify-between items-center text-xs text-slate-300 mb-1.5">
                  <span>Pausa antes de responder Gemini:</span>
                  <span className="font-mono text-sky-400 font-semibold">{silenceDelayMs}ms</span>
                </div>
                <input
                  type="range"
                  min={800}
                  max={2200}
                  step={100}
                  value={silenceDelayMs}
                  onChange={(e) => onChangeSilenceDelay(Number(e.target.value))}
                  className="w-full accent-sky-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>Rápido (800ms)</span>
                  <span>Normal (1200ms)</span>
                  <span>Pausado (2200ms)</span>
                </div>
              </div>
            )}
          </section>

          {/* 4. Persona Selection & Prompt */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <label className="font-semibold text-slate-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Personalidad de la Llamada</span>
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
              {PERSONAS.map((p) => {
                const isSelected = selectedPersonaId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onChangePersona(p.id);
                      if (p.id !== 'custom') {
                        onChangeCustomPrompt(p.systemPrompt);
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-amber-950/40 border-amber-500/80 ring-1 ring-amber-500/40 text-slate-100'
                        : 'bg-slate-850 border-slate-750 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-medium text-xs truncate">{p.name}</div>
                  </button>
                );
              })}
            </div>

            <div className="mt-2">
              <div className="flex justify-between items-center mb-1 text-xs text-slate-400">
                <span>Instrucción del sistema (System Instruction):</span>
                <button
                  type="button"
                  onClick={() => onChangeCustomPrompt(currentPersona.systemPrompt)}
                  className="flex items-center gap-1 text-[11px] text-indigo-400 hover:underline"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restablecer</span>
                </button>
              </div>
              <textarea
                rows={3}
                value={customSystemPrompt}
                onChange={(e) => {
                  onChangeCustomPrompt(e.target.value);
                  onChangePersona('custom');
                }}
                className="w-full bg-slate-800 border border-slate-750 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-sm transition-colors"
          >
            Guardar y Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
