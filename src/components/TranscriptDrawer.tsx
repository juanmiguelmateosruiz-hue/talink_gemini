import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Download,
  Trash2,
  Volume2,
  User,
  Sparkles,
  Send
} from 'lucide-react';
import { MessageItem } from '../types.ts';
import { audioManager } from '../audio/audioManager.ts';

interface TranscriptDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: MessageItem[];
  onClear: () => void;
  onSendMessage?: (text: string) => void;
  isProcessing?: boolean;
}

export const TranscriptDrawer: React.FC<TranscriptDrawerProps> = ({
  isOpen,
  onClose,
  messages,
  onClear,
  onSendMessage,
  isProcessing = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [inputText, setInputText] = useState('');
  const [replayingId, setReplayingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = () => {
    const text = messages
      .map((m) => `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.role === 'user' ? 'Tú' : 'Gemini'}: ${m.text}`)
      .join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const text = messages
      .map((m) => `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.role === 'user' ? 'Tú' : 'Gemini'}: ${m.text}`)
      .join('\n\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcripcion-gemini-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReplayAudio = async (item: MessageItem) => {
    if (!item.audioBase64) return;
    try {
      setReplayingId(item.id);
      await audioManager.playBase64Wav(item.audioBase64);
    } catch (e) {
      console.warn('Replay audio error:', e);
    } finally {
      setReplayingId(null);
    }
  };

  const handleSubmitText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isProcessing) return;
    if (onSendMessage) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Transcripción de la Llamada</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {messages.length} {messages.length === 1 ? 'mensaje registrado' : 'mensajes registrados'}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {messages.length > 0 && (
              <>
                <button
                  onClick={handleCopy}
                  title="Copiar transcripción"
                  className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  onClick={handleDownload}
                  title="Descargar TXT"
                  className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={onClear}
                  title="Borrar historial"
                  className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
              <div className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center mb-3">
                <Sparkles className="w-6 h-6 text-slate-600" />
              </div>
              <p className="text-sm font-medium text-slate-400">Aún no hay diálogo en esta sesión</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Inicia la llamada y habla por tu micrófono para ver la conversación transcrita en tiempo real.
              </p>
            </div>
          ) : (
            messages.map((item) => {
              const isUser = item.role === 'user';
              return (
                <div
                  key={item.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-slate-400">
                    {isUser ? (
                      <>
                        <span>Tú</span>
                        <User className="w-3 h-3 text-sky-400" />
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 text-purple-400" />
                        <span className="font-medium text-purple-300">Gemini</span>
                        {item.latencyMs && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-950/80 text-purple-300 border border-purple-800/50">
                            {item.latencyMs}ms
                          </span>
                        )}
                      </>
                    )}
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-500">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>

                  <div
                    className={`max-w-[88%] rounded-2xl p-3.5 text-sm leading-relaxed ${
                      isUser
                        ? 'bg-sky-600/90 text-white rounded-tr-xs shadow-md'
                        : 'bg-slate-800/90 text-slate-200 border border-slate-750 rounded-tl-xs shadow-sm'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{item.text}</p>

                    {item.audioBase64 && !isUser && (
                      <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex items-center justify-between">
                        <button
                          onClick={() => handleReplayAudio(item)}
                          disabled={replayingId === item.id}
                          className="flex items-center gap-1.5 text-xs text-purple-300 hover:text-purple-200 font-medium transition-colors"
                        >
                          <Volume2 className={`w-3.5 h-3.5 ${replayingId === item.id ? 'animate-pulse text-purple-400' : ''}`} />
                          <span>{replayingId === item.id ? 'Reproduciendo...' : 'Repetir audio'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Text Input Fallback / Hybrid Input */}
        <form onSubmit={handleSubmitText} className="p-3 border-t border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="O escribe un mensaje a Gemini..."
              disabled={isProcessing}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isProcessing}
              className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white rounded-xl transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
