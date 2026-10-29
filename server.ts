import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);
const app = express();
const server = http.createServer(app);

// Middleware for parsing JSON with ample headroom for audio payloads
app.use(express.json({ limit: '40mb' }));
app.use(express.urlencoded({ extended: true, limit: '40mb' }));

// Initialize official @google/genai SDK on the server
// User-Agent must be 'aistudio-build' as per guidelines
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Default persona prompt for natural phone conversation
const DEFAULT_SYSTEM_INSTRUCTION = `Eres Gemini en una llamada telefónica conversacional en tiempo real. 
Hablas de forma natural, cálida, expresiva, empática y concisa como en una auténtica conversación telefónica en español (o el idioma en el que te hable el usuario).
REGLAS VITALES PARA VOZ:
- Respuestas directas, breves y fluidas (generalmente 1 a 3 frases).
- NUNCA uses listas con viñetas (*, -), tablas, bloques de código ni markdown complejo porque se escuchará raro al sintetizarlo en audio.
- Usa lenguaje conversacional natural (por ejemplo: "¡Claro!", "Entiendo perfectamente", "Cuéntame más", "¿Qué opinas?").
- Si el usuario te saluda, salúdalo con entusiasmo. Si te hace una pregunta, responde directamente y mantén la llamada viva con una pregunta de seguimiento natural cuando sea oportuno.`;

// 1. Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY);
  res.json({
    status: 'ok',
    hasApiKey: hasKey,
    models: {
      chat: 'gemini-3.8-flash',
      tts: 'gemini-3.8-flash-lite-tts',
      transcribe: 'gemini-3.5-transcribe',
    },
    timestamp: new Date().toISOString(),
  });
});

// 2. Chat endpoint (conversational)
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const {
      messages = [],
      prompt,
      systemInstruction = DEFAULT_SYSTEM_INSTRUCTION,
      voice = 'Kore',
      generateAudio = true,
    } = req.body;

    // Build contents from history + current prompt
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    if (Array.isArray(messages) && messages.length > 0) {
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
      res.status(400).json({ error: 'No se envió ningún mensaje ni prompt.' });
      return;
    }

    // Call Gemini 3.8 Flash
    const chatResponse = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: contents as any,
      config: {
        systemInstruction,
        temperature: 0.8,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
      },
    });

    const replyText = chatResponse.text?.trim() || 'Disculpa, no pude entender bien. ¿Podrías repetirlo?';

    let audioBase64: string | null = null;

    if (generateAudio) {
      try {
        const ttsResponse = await ai.models.generateContent({
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
                prebuiltVoiceConfig: { voiceName: voice || 'Kore' },
              },
            },
          },
        });

        audioBase64 = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
      } catch (ttsErr: any) {
        console.warn('TTS generation warning:', ttsErr?.message || ttsErr);
      }
    }

    res.json({
      text: replyText,
      audioBase64,
      voice,
    });
  } catch (error: any) {
    console.error('Error in /api/chat:', error);
    res.status(500).json({
      error: error.message || 'Error al comunicarse con Gemini',
      details: error.toString(),
    });
  }
});

// 3. Audio synthesis endpoint (TTS)
app.post('/api/speak', async (req: Request, res: Response) => {
  try {
    const { text, voice = 'Kore' } = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'El parámetro "text" es obligatorio.' });
      return;
    }

    const ttsResponse = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [{ text }],
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

    const audioBase64 = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioBase64) {
      res.status(500).json({ error: 'No se generó audio en la respuesta.' });
      return;
    }

    res.json({
      audioBase64,
      mimeType: 'audio/wav',
      voice,
    });
  } catch (error: any) {
    console.error('Error in /api/speak:', error);
    res.status(500).json({
      error: error.message || 'Error al sintetizar voz',
    });
  }
});

// 4. Audio transcription endpoint
app.post('/api/transcribe', async (req: Request, res: Response) => {
  try {
    const { audioBase64, mimeType = 'audio/webm' } = req.body;
    if (!audioBase64) {
      res.status(400).json({ error: 'Falta el audioBase64.' });
      return;
    }

    const audioPart = {
      inlineData: {
        mimeType: mimeType.split(';')[0] || 'audio/webm',
        data: audioBase64,
      },
    };

    const transcribeResponse = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: {
        parts: [
          audioPart,
          {
            text: 'Transcribe verbatim the speech in this audio clip. Return only the transcription text, nothing else. If there is no discernible speech or only background noise, reply with an empty string.',
          },
        ],
      },
    });

    const transcription = transcribeResponse.text?.trim() || '';
    res.json({ text: transcription });
  } catch (error: any) {
    console.error('Error in /api/transcribe:', error);
    res.status(500).json({
      error: error.message || 'Error al transcribir audio',
    });
  }
});

// 5. Unified Call Turn (User voice/text -> Gemini response -> Gemini TTS)
app.post('/api/call-turn', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const {
      audioBase64,
      mimeType = 'audio/webm',
      userText: providedUserText,
      history = [],
      systemInstruction = DEFAULT_SYSTEM_INSTRUCTION,
      voice = 'Kore',
    } = req.body;

    let userText = (providedUserText || '').trim();

    // Step 1: If audio is provided and no text, transcribe first
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
      if (audioBase64) {
        userText = '(Audio detectado pero tenue)';
        // Provide friendly response
        const fallbackReply = 'Te he escuchado un poco lejos. ¿Podrías repetirme lo que me decías?';
        let fallbackAudio: string | null = null;
        try {
          const ttsResp = await ai.models.generateContent({
            model: 'gemini-3.8-flash-lite-tts',
            contents: [{ role: 'user', parts: [{ text: fallbackReply }] }],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
            },
          });
          fallbackAudio = ttsResp.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
        } catch (_) {}

        res.json({
          userText,
          replyText: fallbackReply,
          audioBase64: fallbackAudio,
          voice,
          latencyMs: Date.now() - startTime,
        });
        return;
      } else {
        res.json({
          userText: '',
          replyText: '',
          audioBase64: null,
          ignored: true,
          reason: 'No se recibió texto ni audio.',
        });
        return;
      }
    }

    // Step 2: Build conversation history
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

    // Step 3: Generate conversational answer
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

    // Step 4: Synthesize high quality speech
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
      console.warn('TTS error in call-turn:', ttsErr?.message);
    }

    const latencyMs = Date.now() - startTime;

    res.json({
      userText,
      replyText,
      audioBase64: audioOutput,
      voice,
      latencyMs,
    });
  } catch (error: any) {
    console.error('Error in /api/call-turn:', error);
    res.status(500).json({
      error: error.message || 'Error en el turno de la llamada',
    });
  }
});

// Configure Vite or Static File Serving
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
