import React from 'react';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Square,
  Sliders,
  FileText,
  HelpCircle,
  Radio,
  Send,
  AlertCircle,
  Play
} from 'lucide-react';
import { CallStatus, InputMode } from '../types.ts';

interface CallControlsProps {
  status: CallStatus;
  isMuted: boolean;
  inputMode: InputMode;
  micError?: string | null;
  hasSpeechText?: boolean;
  onStartCall: () => void;
  onEndCall: () => void;
  onToggleMute: () => void;
  onInterrupt: () => void;
  onToggleSettings: () => void;
  onToggleTranscript: () => void;
  onOpenVercelGuide: () => void;
  onSendNow?: () => void;
  onQuickPrompt?: (prompt: string) => void;
  onPushToTalkDown?: () => void;
  onPushToTalkUp?: () => void;
  isPushTalking?: boolean;
}

export const CallControls: React.FC<CallControlsProps> = ({
  status,
  isMuted,
  inputMode,
  micError,
  hasSpeechText = false,
  onStartCall,
  onEndCall,
  onToggleMute,
  onInterrupt,
  onToggleSettings,
  onToggleTranscript,
  onOpenVercelGuide,
  onSendNow,
  onQuickPrompt,
  onPushToTalkDown,
  onPushToTalkUp,
  isPushTalking = false,
}) => {
  const isCallActive = status !== 'idle' && status !== 'ended';

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center gap-3 px-4 pb-6">
      {/* Mic permission banner if error occurs */}
      {micError && (
        <div className="w-full p-3 rounded-2xl bg-amber-950/70 border border-amber-600/60 text-amber-200 text-xs flex items-start gap-2.5 animate-fade-in shadow-lg">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block text-amber-100">Aviso sobre el Micrófono:</span>
            <span>{micError}</span>
            <div className="mt-1.5 flex gap-2">
              {onQuickPrompt && (
                <button
                  type="button"
                  onClick={() => onQuickPrompt('Hola Gemini, ¿cómo estás?')}
                  className="px-2 py-1 bg-amber-800/60 hover:bg-amber-700/80 rounded-lg text-amber-100 font-medium text-[11px] transition-colors"
                >
                  Probar llamada con frase rápida
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* When Gemini is speaking: Interrupt button */}
      {status === 'speaking' && (
        <button
          onClick={onInterrupt}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-900/80 hover:bg-indigo-800 border border-indigo-400/50 text-indigo-100 text-xs font-semibold rounded-full shadow-lg transition-all transform active:scale-95 animate-pulse"
        >
          <Square className="w-3.5 h-3.5 fill-current" />
          <span>Interrumpir a Gemini (Hablar tú)</span>
        </button>
      )}

      {/* Instant Send Button when user spoke and text is ready */}
      {status === 'listening' && hasSpeechText && onSendNow && (
        <button
          onClick={onSendNow}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-full shadow-lg shadow-emerald-500/20 transition-all transform active:scale-95 animate-bounce"
        >
          <Send className="w-3.5 h-3.5 fill-current" />
          <span>Enviar voz a Gemini ahora</span>
        </button>
      )}

      {/* Push-to-Talk button when call active and in push_to_talk mode */}
      {isCallActive && inputMode === 'push_to_talk' && (
        <button
          onMouseDown={onPushToTalkDown}
          onMouseUp={onPushToTalkUp}
          onTouchStart={onPushToTalkDown}
          onTouchEnd={onPushToTalkUp}
          className={`w-full py-4 px-6 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 border transition-all select-none shadow-md ${
            isPushTalking
              ? 'bg-sky-500 text-white border-sky-400 shadow-sky-500/30 scale-98 ring-4 ring-sky-400/30'
              : 'bg-slate-800/90 text-slate-100 border-slate-700 hover:bg-slate-750 active:bg-slate-700'
          }`}
        >
          <Mic className={`w-5 h-5 ${isPushTalking ? 'animate-bounce text-white' : 'text-sky-400'}`} />
          <span>{isPushTalking ? 'Soltar para que Gemini responda' : 'Mantén presionado para hablar'}</span>
        </button>
      )}

      {/* Primary Phone Buttons Grid */}
      <div className="flex items-center justify-center gap-4 sm:gap-5 w-full">
        {/* Settings button */}
        <button
          onClick={onToggleSettings}
          title="Configuración de voz y modelo"
          className="w-12 h-12 rounded-full bg-slate-800/90 hover:bg-slate-750 border border-slate-700 text-slate-300 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        >
          <Sliders className="w-5 h-5" />
        </button>

        {/* Mute button (only active during call) */}
        {isCallActive && (
          <button
            onClick={onToggleMute}
            title={isMuted ? 'Activar micrófono' : 'Silenciar micrófono'}
            className={`w-13 h-13 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 border ${
              isMuted
                ? 'bg-amber-900/70 text-amber-200 border-amber-600/70'
                : 'bg-slate-800/90 text-slate-200 border-slate-700'
            }`}
          >
            {isMuted ? <MicOff className="w-5 h-5 text-amber-400" /> : <Mic className="w-5 h-5 text-sky-400" />}
          </button>
        )}

        {/* Main Phone Call / Hangup Button */}
        {!isCallActive ? (
          <button
            onClick={onStartCall}
            className="flex-1 max-w-[210px] h-14 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-extrabold rounded-full shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2.5 transition-all transform hover:scale-103 active:scale-97 cursor-pointer"
          >
            <Phone className="w-5 h-5 fill-current" />
            <span className="text-sm tracking-wider uppercase">INICIAR LLAMADA</span>
          </button>
        ) : (
          <button
            onClick={onEndCall}
            className="flex-1 max-w-[210px] h-14 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-extrabold rounded-full shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2.5 transition-all transform hover:scale-103 active:scale-97 cursor-pointer"
          >
            <PhoneOff className="w-5 h-5 fill-current" />
            <span className="text-sm tracking-wider uppercase">COLGAR</span>
          </button>
        )}

        {/* Transcript Drawer button */}
        <button
          onClick={onToggleTranscript}
          title="Ver transcripción completa"
          className="w-12 h-12 rounded-full bg-slate-800/90 hover:bg-slate-750 border border-slate-700 text-slate-300 flex items-center justify-center transition-all hover:scale-105 active:scale-95 relative"
        >
          <FileText className="w-5 h-5" />
        </button>

        {/* Vercel Deployment & Architecture Guide */}
        <button
          onClick={onOpenVercelGuide}
          title="Guía de Arquitectura y Despliegue en Vercel"
          className="w-12 h-12 rounded-full bg-slate-800/90 hover:bg-slate-750 border border-slate-700 text-indigo-300 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
      </div>

      {/* Quick Test Chips (especially great for Computer/Desktop or noisy places) */}
      <div className="w-full flex items-center justify-center gap-1.5 flex-wrap pt-1">
        <span className="text-[11px] text-slate-500 font-medium mr-1">Pruebas rápidas:</span>
        <button
          type="button"
          onClick={() => onQuickPrompt && onQuickPrompt('Hola Gemini, preséntate brevemente.')}
          className="px-2.5 py-1 rounded-full bg-slate-850 hover:bg-slate-800 border border-slate-750 text-slate-300 text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
        >
          <Play className="w-2.5 h-2.5 text-indigo-400" />
          <span>"Preséntate"</span>
        </button>
        <button
          type="button"
          onClick={() => onQuickPrompt && onQuickPrompt('¿Cómo funciona esta llamada de voz por internet?')}
          className="px-2.5 py-1 rounded-full bg-slate-850 hover:bg-slate-800 border border-slate-750 text-slate-300 text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
        >
          <Play className="w-2.5 h-2.5 text-indigo-400" />
          <span>"¿Cómo funciona?"</span>
        </button>
        <button
          type="button"
          onClick={() => onQuickPrompt && onQuickPrompt('Cuéntame una curiosidad científica sorprendente.')}
          className="px-2.5 py-1 rounded-full bg-slate-850 hover:bg-slate-800 border border-slate-750 text-slate-300 text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
        >
          <Play className="w-2.5 h-2.5 text-indigo-400" />
          <span>"Curiosidad"</span>
        </button>
      </div>

      {/* Call state hint text */}
      <div className="text-center text-xs text-slate-400 min-h-[20px] flex items-center justify-center gap-1.5 pt-1">
        {status === 'idle' && <span>Pulsa "INICIAR LLAMADA" para hablar directamente con Gemini</span>}
        {status === 'connecting' && <span className="text-sky-400 animate-pulse">Conectando canal de audio...</span>}
        {status === 'listening' && (
          <span className="text-emerald-400 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            {inputMode === 'auto'
              ? 'Escuchándote... Habla y Gemini responderá en cuanto hagas una pausa'
              : 'Mantén presionado el botón para hablar'}
          </span>
        )}
        {status === 'processing' && <span className="text-amber-400 animate-pulse">Gemini procesando y sintetizando voz...</span>}
        {status === 'speaking' && <span className="text-purple-400 animate-pulse font-medium">Gemini respondiendo por los altavoces...</span>}
        {status === 'ended' && <span>Llamada finalizada</span>}
      </div>
    </div>
  );
};
