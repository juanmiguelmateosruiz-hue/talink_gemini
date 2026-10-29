import React, { useEffect, useRef } from 'react';
import { CallStatus } from '../types.ts';
import { audioManager } from '../audio/audioManager.ts';

interface AudioWaveformProps {
  status: CallStatus;
  userVolume: number;
  isMuted: boolean;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({ status, userVolume, isMuted }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let phase = 0;

    const render = () => {
      phase += 0.04;
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Gradient background glow
      const radialGlow = ctx.createRadialGradient(
        width / 2, centerY, 10,
        width / 2, centerY, width / 2
      );

      if (status === 'speaking') {
        radialGlow.addColorStop(0, 'rgba(99, 102, 241, 0.28)');
        radialGlow.addColorStop(0.5, 'rgba(168, 85, 247, 0.12)');
        radialGlow.addColorStop(1, 'rgba(15, 23, 42, 0)');
      } else if (status === 'listening') {
        radialGlow.addColorStop(0, 'rgba(56, 189, 248, 0.24)');
        radialGlow.addColorStop(0.5, 'rgba(45, 212, 191, 0.10)');
        radialGlow.addColorStop(1, 'rgba(15, 23, 42, 0)');
      } else if (status === 'processing') {
        radialGlow.addColorStop(0, 'rgba(234, 179, 8, 0.20)');
        radialGlow.addColorStop(0.6, 'rgba(249, 115, 22, 0.08)');
        radialGlow.addColorStop(1, 'rgba(15, 23, 42, 0)');
      } else {
        radialGlow.addColorStop(0, 'rgba(71, 85, 105, 0.12)');
        radialGlow.addColorStop(1, 'rgba(15, 23, 42, 0)');
      }

      ctx.fillStyle = radialGlow;
      ctx.fillRect(0, 0, width, height);

      // Determine wave intensity
      let intensity = 0.2;
      if (status === 'listening' && !isMuted) {
        intensity = 0.25 + Math.min(userVolume * 4, 1.2);
      } else if (status === 'speaking') {
        // Natural speech modulation
        intensity = 0.6 + Math.sin(phase * 1.5) * 0.25 + Math.cos(phase * 3.2) * 0.15;
      } else if (status === 'processing') {
        intensity = 0.35 + Math.sin(phase * 2) * 0.15;
      } else if (status === 'idle') {
        intensity = 0.15 + Math.sin(phase * 0.8) * 0.05;
      }

      // Draw multi-layered sine waves
      const waves = [
        {
          color: status === 'speaking' ? 'rgba(129, 140, 248, 0.85)' : status === 'listening' ? 'rgba(56, 189, 248, 0.85)' : 'rgba(148, 163, 184, 0.4)',
          speed: 1.0,
          freq: 0.018,
          amp: 45 * intensity,
          lineWidth: 3,
        },
        {
          color: status === 'speaking' ? 'rgba(192, 132, 252, 0.7)' : status === 'listening' ? 'rgba(45, 212, 191, 0.7)' : 'rgba(100, 116, 139, 0.3)',
          speed: 1.4,
          freq: 0.024,
          amp: 32 * intensity,
          lineWidth: 2,
        },
        {
          color: status === 'speaking' ? 'rgba(244, 114, 182, 0.6)' : status === 'listening' ? 'rgba(96, 165, 250, 0.6)' : 'rgba(71, 85, 105, 0.2)',
          speed: 0.7,
          freq: 0.012,
          amp: 20 * intensity,
          lineWidth: 1.5,
        },
      ];

      waves.forEach((w) => {
        ctx.beginPath();
        ctx.lineWidth = w.lineWidth;
        ctx.strokeStyle = w.color;

        for (let x = 0; x <= width; x += 3) {
          // Window function so edges fade to center line smoothly
          const edgeFade = Math.sin((x / width) * Math.PI);
          const y =
            centerY +
            Math.sin(x * w.freq + phase * w.speed) * w.amp * edgeFade +
            Math.cos(x * w.freq * 0.6 - phase * 0.5) * (w.amp * 0.4) * edgeFade;

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      });

      // Central Orb in the middle
      const orbRadius = 40 + (status === 'speaking' || status === 'listening' ? intensity * 15 : 0);
      const orbGrad = ctx.createRadialGradient(
        width / 2, centerY, 5,
        width / 2, centerY, orbRadius
      );

      if (status === 'speaking') {
        orbGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        orbGrad.addColorStop(0.3, 'rgba(147, 197, 253, 0.8)');
        orbGrad.addColorStop(0.7, 'rgba(99, 102, 241, 0.4)');
        orbGrad.addColorStop(1, 'rgba(99, 102, 241, 0)');
      } else if (status === 'listening') {
        orbGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        orbGrad.addColorStop(0.3, 'rgba(56, 189, 248, 0.8)');
        orbGrad.addColorStop(0.7, 'rgba(20, 184, 166, 0.35)');
        orbGrad.addColorStop(1, 'rgba(20, 184, 166, 0)');
      } else if (status === 'processing') {
        orbGrad.addColorStop(0, 'rgba(254, 240, 138, 0.9)');
        orbGrad.addColorStop(0.4, 'rgba(234, 179, 8, 0.7)');
        orbGrad.addColorStop(1, 'rgba(234, 179, 8, 0)');
      } else {
        orbGrad.addColorStop(0, 'rgba(203, 213, 225, 0.6)');
        orbGrad.addColorStop(0.5, 'rgba(100, 116, 139, 0.3)');
        orbGrad.addColorStop(1, 'rgba(100, 116, 139, 0)');
      }

      ctx.beginPath();
      ctx.arc(width / 2, centerY, orbRadius, 0, Math.PI * 2);
      ctx.fillStyle = orbGrad;
      ctx.fill();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [status, userVolume, isMuted]);

  return (
    <div className="relative w-full max-w-lg aspect-square flex items-center justify-center mx-auto my-4">
      <canvas
        ref={canvasRef}
        width={420}
        height={420}
        className="w-full h-full rounded-full"
      />
      {/* Decorative center avatar/badge */}
      <div className="absolute flex flex-col items-center pointer-events-none">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl backdrop-blur-md ${
          status === 'speaking'
            ? 'bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 ring-4 ring-purple-400/50 scale-105'
            : status === 'listening'
            ? 'bg-gradient-to-tr from-cyan-600 via-sky-600 to-teal-500 ring-4 ring-cyan-400/50 scale-100'
            : status === 'processing'
            ? 'bg-gradient-to-tr from-amber-600 via-yellow-600 to-orange-500 ring-4 ring-amber-400/50 animate-pulse'
            : 'bg-slate-800/80 ring-2 ring-slate-700/60'
        }`}>
          <div className="relative flex items-center justify-center">
            {/* Sparkles / Gemini star logo */}
            <svg
              className={`w-9 h-9 text-white transition-transform duration-700 ${
                status === 'speaking' || status === 'processing' ? 'rotate-180 scale-110' : ''
              }`}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};
