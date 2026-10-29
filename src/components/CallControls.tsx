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
  Keyboard
} from 'lucide-react';
import { CallStatus, InputMode } from '../types.ts';

interface CallControlsProps {
  status: CallStatus;
  isMuted: boolean;
  inputMode: InputMode;
  onStartCall: () => void;
  onEndCall: () => void;
  onToggleMute: () => void;
  onInterrupt: () => void;
  onToggleSettings: () => void;
  onToggleTranscript: () => void;
  onOpenVercelGuide: () => void;
  onPushToTalkDown?: () => void;
  onPushToTalkUp?: () => void;
  isPushTalking?: boolean;
}

export const CallControls: React.FC<CallControlsProps> = ({
  status,
  isMuted,
  inputMode,
  onStartCall,
  onEndCall,
  onToggleMute,
  onInterrupt,
  onToggleSettings,
  onToggleTranscript,
  onOpenVercelGuide,
  onPushToTalkDown,
  onPushToTalkUp,
  isPushTalking = false,
}) => {
  const isCallActive = status !== 'idle' && status !== 'ended';

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center gap-4 px-4 pb-6">
      {/* Top action row: Interruption or Push to Talk banner */}
      {status === 'speaking' && (
        <button
          onClick={onInterrupt}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-900/60 hover:bg-indigo-800/80 border border-indigo-500/40 text-indigo-200 text-xs font-semibold rounded-full shadow-lg transition-all transform active:scale-95 animate-pulse"
        >
          <Square className="w-3.5 h-3.5 fill-current" />
          <span>Interrumpir a Gemini (Hablar tú)</span>
        </button>
      )}

      {/* Push-to-Talk button when call active and in push_to_talk mode */}
      {isCallActive && inputMode === 'push_to_talk' && (
        <button
          onMouseDown={onPushToTalkDown}
          onMouseUp={onPushToTalkUp}
          onTouchStart={onPushToTalkDown}
          onTouchEnd={onPushToTalkUp}
          className={`w-full py-3.5 px-6 rounded-2xl font-medium text-sm flex items-center justify-center gap-2 border transition-all select-none ${
            isPushTalking
              ? 'bg-sky-500 text-white border-sky-400 shadow-lg shadow-sky-500/30 scale-98'
              : 'bg-slate-800/90 text-slate-200 border-slate-700 hover:bg-slate-750'
          }`}
        >
          <Mic className={`w-4 h-4 ${isPushTalking ? 'animate-bounce' : ''}`} />
          <span>{isPushTalking ? 'Soltar para enviar a Gemini' : 'Mantén presionado para hablar'}</span>
        </button>
      )}

      {/* Primary Phone Buttons Grid */}
      <div className="flex items-center justify-center gap-5 w-full">
        {/* Settings button */}
        <button
          onClick={onToggleSettings}
          title="Configuración de voz y modelo"
          className="w-12 h-12 rounded-full bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 text-slate-300 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
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
                ? 'bg-amber-900/60 text-amber-200 border-amber-600/60'
                : 'bg-slate-800/90 text-slate-200 border-slate-700'
            }`}
          >
            {isMuted ? <MicOff className="w-5 h-5 text-amber-400" /> : <Mic className="w-5 h-5" />}
          </button>
        )}

        {/* Main Phone Call / Hangup Button */}
        {!isCallActive ? (
          <button
            onClick={onStartCall}
            className="flex-1 max-w-[200px] h-14 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold rounded-full shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2.5 transition-all transform hover:scale-103 active:scale-97"
          >
            <Phone className="w-5 h-5 fill-current" />
            <span className="text-sm tracking-wide uppercase">Iniciar Llamada</span>
          </button>
        ) : (
          <button
            onClick={onEndCall}
            className="flex-1 max-w-[200px] h-14 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold rounded-full shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2.5 transition-all transform hover:scale-103 active:scale-97"
          >
            <PhoneOff className="w-5 h-5 fill-current" />
            <span className="text-sm tracking-wide uppercase">Colgar</span>
          </button>
        )}

        {/* Transcript Drawer button */}
        <button
          onClick={onToggleTranscript}
          title="Ver transcripción completa"
          className="w-12 h-12 rounded-full bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 text-slate-300 flex items-center justify-center transition-all hover:scale-105 active:scale-95 relative"
        >
          <FileText className="w-5 h-5" />
        </button>

        {/* Vercel Deployment & Architecture Guide */}
        <button
          onClick={onOpenVercelGuide}
          title="Guía de Arquitectura y Despliegue en Vercel"
          className="w-12 h-12 rounded-full bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 text-indigo-300 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
      </div>

      {/* Call state hint text */}
      <div className="text-center text-xs text-slate-400 min-h-[20px] flex items-center justify-center gap-1.5">
        {status === 'idle' && <span>Pulsa "Iniciar Llamada" para comenzar la conversación por voz</span>}
        {status === 'connecting' && <span className="text-sky-400 animate-pulse">Conectando llamada con Gemini...</span>}
        {status === 'listening' && (
          <span className="text-emerald-400 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            {inputMode === 'auto'
              ? 'Micrófono activo (Habla libremente, Gemini responderá al pausar)'
              : 'Mantén presionado el botón para hablar'}
          </span>
        )}
        {status === 'processing' && <span className="text-amber-400 animate-pulse">Gemini procesando respuesta...</span>}
        {status === 'speaking' && <span className="text-purple-400 animate-pulse">Gemini hablando...</span>}
        {status === 'ended' && <span>Llamada finalizada</span>}
      </div>
    </div>
  );
};
