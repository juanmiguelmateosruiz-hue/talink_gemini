import type { Request, Response } from 'express';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const DEFAULT_SYSTEM_INSTRUCTION = `Eres Gemini en una llamada telefónica conversacional en tiempo real. 
Hablas de forma natural, cálida, expresiva, empática y concisa como en una auténtica conversación telefónica en español (o el idioma en el que te hable el usuario).
REGLAS VITALES PARA VOZ:
- Respuestas directas, breves y fluidas (generalmente 1 a 3 frases).
- NUNCA uses listas con viñetas (*, -), tablas, bloques de código ni markdown complejo porque se escuchará raro al sintetizarlo en audio.
- Usa lenguaje conversacional natural (por ejemplo: "¡Claro!", "Entiendo perfectamente", "Cuéntame más", "¿Qué opinas?").
- Si el usuario te saluda, salúdalo con entusiasmo. Si te hace una pregunta, responde directamente y mantén la llamada viva con una pregunta de seguimiento natural cuando sea oportuno.`;

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  try {
    const {
      audioBase64,
      mimeType = 'audio/webm',
      userText: providedUserText,
      history = [],
      systemInstruction = DEFAULT_SYSTEM_INSTRUCTION,
      voice = 'Kore',
    } = req.body || {};

    let userText = (providedUserText || '').trim();

    // 1. Transcribe audio if needed
    if (!userText && audioBase64) {
      try {
        const audioPart = {
          inlineData: {
            mimeType: mimeType.split(';')[0] || 'audio/webm',
            data: audioBase64,
          },
        };

        const transcribeResp = await ai.models.generateContent({
          model: 'gemini-3.5-transcribe',
          contents: {
            parts: [
              audioPart,
              {
                text: 'Transcribe verbatim the spoken words in this audio. Output only the exact transcribed words without quotes or punctuation if unclear. If silence or noise, output nothing.',
              },
            ],
          },
        });

        userText = transcribeResp.text?.trim() || '';
      } catch (err: any) {
        console.warn('Transcription error:', err.message);
      }
    }

    if (!userText) {
      return res.json({
        userText: '',
        replyText: '',
        audioBase64: null,
        ignored: true,
        reason: 'No se detectó voz clara.',
      });
    }

    // 2. Build conversation history
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    if (Array.isArray(history)) {
      for (const item of history.slice(-8)) {
        if (item.text) {
          contents.push({
            role: item.role === 'model' || item.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: String(item.text) }],
          });
        }
      }
    }
    contents.push({
      role: 'user',
      parts: [{ text: userText }],
    });

    // 3. Generate response with Gemini 3.8 Flash
    const replyResp = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: contents as any,
      config: {
        systemInstruction,
        temperature: 0.7,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
      },
    });

    const replyText = replyResp.text?.trim() || 'Te escucho.';

    // 4. Synthesize voice with Gemini 3.8 Flash Lite TTS
    let audioOutput: string | null = null;
    try {
      const ttsResp = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [{ text: replyText }],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
      });

      audioOutput = ttsResp.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    } catch (ttsErr: any) {
      console.warn('TTS error:', ttsErr?.message);
    }

    return res.json({
      userText,
      replyText,
      audioBase64: audioOutput,
      voice,
      latencyMs: Date.now() - startTime,
    });
  } catch (error: any) {
    console.error('Call turn error:', error);
    return res.status(500).json({
      error: error.message || 'Error en el turno de la llamada',
    });
  }
}
