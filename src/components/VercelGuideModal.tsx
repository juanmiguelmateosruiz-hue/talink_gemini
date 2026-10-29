import React, { useState } from 'react';
import {
  X,
  Server,
  Cloud,
  CheckCircle,
  AlertTriangle,
  Code2,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Zap
} from 'lucide-react';

interface VercelGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VercelGuideModal: React.FC<VercelGuideModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'architecture' | 'steps' | 'code'>('architecture');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyCode = (code: string, key: string) => {
    navigator.clipboard.writeText(code);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const vercelJsonSnippet = `{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist"
}`;

  const callTurnSnippet = `// api/call-turn.ts (Función Serverless en Vercel)
import type { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
});

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).end();
  
  const { userText, audioBase64, history = [], voice = 'Kore' } = req.body;
  
  // 1. Llamada a Gemini 3.8 Flash con el SDK oficial
  const chat = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: [...history, { role: 'user', parts: [{ text: userText }] }],
    config: { systemInstruction: 'Habla de forma natural y concisa para voz.' }
  });
  
  const replyText = chat.text;

  // 2. Síntesis de voz directa con Gemini 3.8 Flash Lite TTS
  const tts = await ai.models.generateContent({
    model: 'gemini-3.8-flash-lite-tts',
    contents: [{ role: 'user', parts: [{ text: replyText }] }],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } }
    }
  });

  const audioBase64 = tts.candidates[0].content.parts[0].inlineData.data;
  return res.json({ replyText, audioBase64 });
}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Arquitectura & Despliegue en Vercel
              </h2>
              <p className="text-xs text-slate-400">
                Solución a los bloqueos de CORS, código 1008 y error 404
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-900/50 px-6 pt-2 gap-2 text-xs font-medium">
          <button
            onClick={() => setActiveTab('architecture')}
            className={`pb-3 px-3 border-b-2 transition-all ${
              activeTab === 'architecture'
                ? 'border-indigo-500 text-indigo-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            ¿Por qué fallaron los intentos anteriores?
          </button>
          <button
            onClick={() => setActiveTab('steps')}
            className={`pb-3 px-3 border-b-2 transition-all ${
              activeTab === 'steps'
                ? 'border-indigo-500 text-indigo-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Guía de Despliegue (GitHub + Vercel)
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`pb-3 px-3 border-b-2 transition-all ${
              activeTab === 'code'
                ? 'border-indigo-500 text-indigo-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Archivos Serverless Vercel
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-sm text-slate-300">
          {activeTab === 'architecture' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-900/50 space-y-2.5">
                <div className="flex items-center gap-2 text-rose-300 font-semibold text-xs tracking-wider uppercase">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Los obstáculos encontrados y por qué ocurrían</span>
                </div>
                <div className="space-y-2 text-xs text-rose-200/90 leading-relaxed">
                  <p>
                    <strong className="text-white">1. Intento WebSockets directos (Código 1008 / Origin Policy):</strong> Google bloquea de forma inmediata las conexiones WebSocket crudas directas desde el navegador (GitHub Pages/Vercel) porque la API de Google requiere autenticación de sesión de servidor o tokens efímeros autorizados. El navegador nunca debe abrir el socket directamente sin backend intermedio.
                  </p>
                  <p>
                    <strong className="text-white">2. Intento HTTP POST directo (Error 404 Model Not Found):</strong> Al llamar a la API REST directamente desde el frontend estático a endpoints obsoletos o v1beta con nombres de modelos deprecados (`gemini-1.5-flash`), la API rechaza el origen o devuelve 404 porque esas rutas cambiaron de esquema y requieren el SDK oficial con firmas de cabecera válidas.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-900/50 space-y-2.5">
                <div className="flex items-center gap-2 text-indigo-300 font-semibold text-xs tracking-wider uppercase">
                  <ShieldCheck className="w-4 h-4" />
                  <span>La Arquitectura Ganadora Implementada Aquí</span>
                </div>
                <div className="space-y-2 text-xs text-indigo-200/90 leading-relaxed">
                  <p>
                    <strong className="text-white">Backend Proxy con SDK Oficial (@google/genai):</strong> La aplicación cuenta con un servidor intermedio (Express en local / Serverless Functions en Vercel) que ejecuta el SDK oficial de Google.
                  </p>
                  <p>
                    <strong className="text-white">Modelos Oficiales de Última Generación:</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-1 pl-2">
                    <li><code className="text-indigo-300 font-mono">gemini-3.8-flash</code>: Para la inteligencia conversacional y respuestas orales en tiempo real.</li>
                    <li><code className="text-indigo-300 font-mono">gemini-3.8-flash-lite-tts</code>: Para generar audio WAV de 24kHz hiperrealista (voces Kore, Puck, Fenrir, Zephyr, Charon).</li>
                    <li><code className="text-indigo-300 font-mono">gemini-3.5-transcribe</code>: Para transcripción universal en dispositivos donde Web Speech API no esté disponible (como Firefox o iOS).</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'steps' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-800/60 border border-slate-750">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <h4 className="font-semibold text-slate-100 text-xs">Sube el código a GitHub</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Crea un repositorio en GitHub y sube todos los archivos de esta app. Ya incluye la configuración completa de Vite, Express y las Serverless Functions en <code className="text-sky-300 font-mono">/api/</code>.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-800/60 border border-slate-750">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <h4 className="font-semibold text-slate-100 text-xs">Importa el proyecto en Vercel</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Ve a <span className="text-indigo-300 font-medium">vercel.com</span>, haz clic en "Add New Project" y selecciona tu repositorio de GitHub. Vercel detectará Vite automáticamente.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-800/60 border border-slate-750">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <h4 className="font-semibold text-slate-100 text-xs">Configura la variable de entorno</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    En la sección <strong>Environment Variables</strong> de Vercel, agrega:
                  </p>
                  <div className="mt-2 p-2 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-emerald-300 flex items-center justify-between">
                    <span>GEMINI_API_KEY = tu_clave_de_google_ai_studio</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Tu clave estará 100% segura en el servidor de Vercel, nunca expuesta en el navegador.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-800/60 border border-slate-750">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  4
                </div>
                <div>
                  <h4 className="font-semibold text-slate-100 text-xs">Haz clic en "Deploy"</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    ¡Listo! Vercel desplegará la interfaz estática optimizada y levantará las funciones en <code className="text-sky-300 font-mono">/api/call-turn</code> de manera serverless totalmente gratuita.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'code' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>vercel.json (Ya creado en la raíz)</span>
                  </span>
                  <button
                    onClick={() => copyCode(vercelJsonSnippet, 'vercelJson')}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"
                  >
                    {copiedKey === 'vercelJson' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'vercelJson' ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 overflow-x-auto">
                  {vercelJsonSnippet}
                </pre>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>api/call-turn.ts (Función Serverless en Vercel)</span>
                  </span>
                  <button
                    onClick={() => copyCode(callTurnSnippet, 'callTurn')}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"
                  >
                    {copiedKey === 'callTurn' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'callTurn' ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 overflow-x-auto max-h-48">
                  {callTurnSnippet}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 text-sm font-medium rounded-xl transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
