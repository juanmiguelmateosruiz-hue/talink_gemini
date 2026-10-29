export type CallStatus = 'idle' | 'connecting' | 'listening' | 'processing' | 'speaking' | 'ended';

export type InputMode = 'auto' | 'push_to_talk' | 'text';

export type AudioEngine = 'gemini_tts' | 'browser_speech';

export interface MessageItem {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  audioBase64?: string;
  latencyMs?: number;
}

export interface VoiceOption {
  id: string;
  name: string;
  gender: 'female' | 'male' | 'neutral';
  tone: string;
  description: string;
}

export const GEMINI_VOICES: VoiceOption[] = [
  { id: 'Kore', name: 'Kore', gender: 'female', tone: 'Cálida y natural', description: 'Voz femenina dulce, clara y cercana. Ideal para conversación diaria.' },
  { id: 'Puck', name: 'Puck', gender: 'male', tone: 'Enérgica y juvenil', description: 'Voz masculina dinámica, alegre y expresiva.' },
  { id: 'Fenrir', name: 'Fenrir', gender: 'male', tone: 'Profunda y firme', description: 'Voz masculina grave, profesional y con presencia.' },
  { id: 'Zephyr', name: 'Zephyr', gender: 'female', tone: 'Suave y reflexiva', description: 'Voz femenina tranquila, empática y serena.' },
  { id: 'Charon', name: 'Charon', gender: 'male', tone: 'Informativa y sobria', description: 'Voz masculina neutral, clara y directa.' },
];

export interface PersonaOption {
  id: string;
  name: string;
  icon: string;
  description: string;
  systemPrompt: string;
}

export const PERSONAS: PersonaOption[] = [
  {
    id: 'companion',
    name: 'Amigo de Charla',
    icon: 'MessageCircleHeart',
    description: 'Conversación amigable, cercana, empática y con sentido del humor.',
    systemPrompt: `Eres Gemini en una llamada telefónica amigable e informal. Eres un gran amigo, conversas de manera relajada, empática y entretenida. Respuestas muy cortas (1-3 frases) y naturales para voz. Sin listas ni formato escrito.`
  },
  {
    id: 'language_tutor',
    name: 'Profesor de Idiomas',
    icon: 'Languages',
    description: 'Practica conversación, corrige con sutileza y propone temas fluidos.',
    systemPrompt: `Eres un tutor de conversación interactiva por teléfono. Ayudas al usuario a hablar con fluidez, corriges con amabilidad si comete un error clave, y haces preguntas abiertas para mantener el diálogo vivo. Respuestas concisas y orales.`
  },
  {
    id: 'executive_assistant',
    name: 'Asistente Ejecutivo',
    icon: 'Briefcase',
    description: 'Rápido, ordenado, directo al grano y enfocado en productividad.',
    systemPrompt: `Eres un asistente personal telefónico de alta eficiencia. Respuestas concisas, resolutivas y directas. Prioriza claridad oral sin rodeos innecesarios.`
  },
  {
    id: 'tech_mentor',
    name: 'Mentor Tecnológico',
    icon: 'Cpu',
    description: 'Explica conceptos complejos de software, IA y ciencia de forma simple al teléfono.',
    systemPrompt: `Eres un mentor senior de tecnología en una llamada telefónica. Explicas conceptos complejos en palabras sencillas y directas. Nunca leas código largo; describe la idea arquitectónica y conversa de forma natural.`
  },
  {
    id: 'custom',
    name: 'Personalizado',
    icon: 'Sliders',
    description: 'Define tu propia instrucción de sistema para la llamada.',
    systemPrompt: `Eres un asistente telefónico conversacional en tiempo real. Responde de forma concisa y natural para voz.`
  }
];
