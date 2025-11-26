import { useEffect, useRef } from 'react';
import { WasmAudioEngine } from '../../audio/WasmAudioEngine';
import { useAppStore } from '../../store/useAppStore';

interface VisualizerProps {
  audioEngine: WasmAudioEngine | null;
}

export default function Visualizer({ audioEngine }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  
  const waveform = useAppStore((state) => state.synthesis.waveform);
  const lfoEnabled = useAppStore((state) => state.synthesis.lfo.enabled);
  const lfoRate = useAppStore((state) => state.synthesis.lfo.rate);
  const filterEnabled = useAppStore((state) => state.synthesis.filter.enabled);
  const tremoloEnabled = useAppStore((state) => state.effects.tremolo.enabled);
  const reverbEnabled = useAppStore((state) => state.effects.reverb.enabled);
  const delayEnabled = useAppStore((state) => state.effects.delay.enabled);

  useEffect(() => {
    if (!audioEngine || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get audio context from engine
    const audioContext = (audioEngine as any).audioContext;
    if (!audioContext) return;

    // Create analyser if not exists
    if (!analyserRef.current) {
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      
      // Connect to script node to tap the audio
      const scriptNode = (audioEngine as any).scriptNode;
      if (scriptNode) {
        scriptNode.connect(analyser);
      }
      
      analyserRef.current = analyser;
      const buffer = new ArrayBuffer(analyser.frequencyBinCount);
      dataArrayRef.current = new Uint8Array(buffer);
    }

    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current!;

    const draw = () => {
      if (!ctx || !analyser || !dataArray) return;

      animationRef.current = requestAnimationFrame(draw);

      analyser.getByteTimeDomainData(dataArray as any);

      // Dynamic background based on effects
      const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      if (reverbEnabled || delayEnabled) {
        bgGradient.addColorStop(0, '#1e1b4b');
        bgGradient.addColorStop(1, '#312e81');
      } else {
        bgGradient.addColorStop(0, '#0f172a');
        bgGradient.addColorStop(1, '#1e293b');
      }
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= 4; i++) {
        const y = (canvas.height / 4) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Waveform
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      if (lfoEnabled) {
        gradient.addColorStop(0, '#8b5cf6');
        gradient.addColorStop(0.5, '#ec4899');
        gradient.addColorStop(1, '#f97316');
      } else if (tremoloEnabled) {
        gradient.addColorStop(0, '#fbbf24');
        gradient.addColorStop(1, '#f59e0b');
      } else if (filterEnabled) {
        gradient.addColorStop(0, '#06b6d4');
        gradient.addColorStop(1, '#3b82f6');
      } else {
        gradient.addColorStop(0, '#10b981');
        gradient.addColorStop(1, '#059669');
      }

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 3;
      ctx.shadowColor = gradient.toString();
      ctx.shadowBlur = 10;
      ctx.beginPath();

      const sliceWidth = canvas.width / dataArray.length;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * (canvas.height / 2);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Frequency spectrum
      const freqBuffer = new ArrayBuffer(analyser.frequencyBinCount);
      const freqData = new Uint8Array(freqBuffer);
      analyser.getByteFrequencyData(freqData as any);
      
      const barCount = 64;
      const barWidth = canvas.width / barCount;
      
      for (let i = 0; i < barCount; i++) {
        const barHeight = (freqData[i] / 255) * (canvas.height * 0.4);
        const hue = (i / barCount) * 120 + 180;
        ctx.fillStyle = `hsla(${hue}, 70%, 50%, 0.5)`;
        ctx.fillRect(
          i * barWidth,
          canvas.height - barHeight,
          barWidth - 2,
          barHeight
        );
      }

      // Compact info text - single line
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      const activeEffects = [];
      if (lfoEnabled) activeEffects.push('LFO');
      if (filterEnabled) activeEffects.push('FLT');
      if (tremoloEnabled) activeEffects.push('TRM');
      if (reverbEnabled) activeEffects.push('RVB');
      if (delayEnabled) activeEffects.push('DLY');
      const effectsText = activeEffects.length > 0 ? ` | ${activeEffects.join(' ')}` : '';
      ctx.fillText(`${waveform.toUpperCase()}${effectsText}`, 8, 12);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [audioEngine, waveform, lfoEnabled, lfoRate, filterEnabled, tremoloEnabled, reverbEnabled, delayEnabled]);

  return (
    <div className="bg-slate-800/80 backdrop-blur-md rounded-lg p-2 border-2 border-slate-700 h-full">
      <canvas
        ref={canvasRef}
        width={800}
        height={64}
        className="w-full bg-slate-900/50 rounded"
      />
    </div>
  );
}
