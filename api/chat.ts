import type { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages = [], prompt, systemInstruction, voice = 'Kore', generateAudio = true } = req.body || {};

    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    if (Array.isArray(messages)) {
      for (const m of messages) {
        if (m.content) {
          contents.push({
            role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
            parts: [{ text: String(m.content) }],
          });
        }
      }
    }

    if (prompt) {
      contents.push({
        role: 'user',
        parts: [{ text: String(prompt) }],
      });
    }

    if (contents.length === 0) {
      return res.status(400).json({ error: 'No se envió mensaje' });
    }

    const chatResponse = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: contents as any,
      config: {
        systemInstruction: systemInstruction || 'Eres un asistente conversacional telefónico amigable, conciso y empático.',
        temperature: 0.8,
      },
    });

    const replyText = chatResponse.text?.trim() || 'Disculpa, no te entendí bien.';
    let audioBase64: string | null = null;

    if (generateAudio) {
      try {
        const ttsResponse = await ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [{ role: 'user', parts: [{ text: replyText }] }],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice },
              },
            },
          },
        });
        audioBase64 = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
      } catch (err: any) {
        console.warn('TTS error:', err?.message);
      }
    }

    return res.json({ text: replyText, audioBase64, voice });
  } catch (error: any) {
    console.error('Chat error:', error);
    return res.status(500).json({ error: error.message || 'Error en Gemini' });
  }
}
