// Audio engine that uses Rust WASM for ALL DSP processing
// Runs WASM in main thread, uses ScriptProcessorNode for audio output
// ALL audio effects are now processed in Rust for maximum performance!

import type { Pattern, RecordedNote, TimelineClip } from '../store/useAppStore';

export class WasmAudioEngine {
  public wasmEngine: any = null; // Made public for direct timeline engine access
  private audioContext: AudioContext | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  private monitorGain: GainNode | null = null;
  private isInitialized = false;
  private wasmModule: any = null;
  private bufferSize = 2048; // Larger buffer to reduce glitches
  private isPcmRecording = false;
  private pcmBuffers: Float32Array[] = [];

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('Loading WASM module...');
      
      // Load WASM module
      // @ts-ignore - Dynamic WASM import
      this.wasmModule = await import('./wasm/rust_dsp.js');
      await this.wasmModule.default();
      
      console.log('WASM module loaded');

      // Create AudioContext
      this.audioContext = new AudioContext({
        sampleRate: 48000,
        latencyHint: 'interactive',
      });

      console.log('AudioContext created, sample rate:', this.audioContext.sampleRate);

      // Create WASM audio engine
      this.wasmEngine = new this.wasmModule.AudioEngine();
      console.log('WASM AudioEngine created');

      // Set initial parameters
      this.wasmEngine.set_master_volume(1.0); // Master at 100%
      this.wasmEngine.set_timeline_volume(0.7); // Timeline at 70%
      this.wasmEngine.set_live_volume(0.7); // Live at 70%
      this.wasmEngine.set_waveform(0); // Sine
      this.wasmEngine.set_adsr(0.01, 0.2, 1.0, 0.3); // Attack, Decay, Sustain, Release

      // Create ScriptProcessorNode for audio processing
      // Note: ScriptProcessorNode is deprecated but works everywhere
      // AudioWorklet is preferred but has WASM loading issues
      this.scriptNode = this.audioContext.createScriptProcessor(
        this.bufferSize,
        0, // no inputs
        2  // stereo output
      );

      // Audio processing callback
      this.scriptNode.onaudioprocess = (event) => {
        const outputL = event.outputBuffer.getChannelData(0);
        const outputR = event.outputBuffer.getChannelData(1);
        const length = outputL.length;

        const wasmBuffer = new Float32Array(length);

        try {
          this.wasmEngine.process(wasmBuffer);

          if (this.isPcmRecording) {
            this.pcmBuffers.push(wasmBuffer.slice());
          }

          for (let i = 0; i < length; i++) {
            outputL[i] = wasmBuffer[i];
            outputR[i] = wasmBuffer[i];
          }
        } catch (error) {
          console.error('WASM processing error:', error);
          outputL.fill(0);
          outputR.fill(0);
        }
      };

      // Create a monitor gain node so we can mute output during exports
      this.monitorGain = this.audioContext.createGain();
      this.monitorGain.gain.value = 1.0;

      // Route ScriptProcessor -> monitor gain -> destination (all effects are in Rust now!)
      this.scriptNode.connect(this.monitorGain);
      this.monitorGain.connect(this.audioContext.destination);

      this.isInitialized = true;
      console.log('✅ WASM Audio Engine initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize WASM audio engine:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (!this.audioContext) {
      await this.initialize();
    }
    
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  noteOn(midiNote: number, velocity: number = 1.0): void {
    if (this.wasmEngine) {
      console.log('🎵 WASM noteOn:', midiNote, 'velocity:', velocity);
      this.wasmEngine.note_on(midiNote, velocity);
    } else {
      console.warn('⚠️ WASM engine not ready');
    }
  }

  noteOff(midiNote: number, immediate: boolean = false): void {
    if (this.wasmEngine) {
      console.log('🎵 WASM noteOff:', midiNote, immediate ? '(immediate)' : '(release envelope)');
      if (immediate) {
        // Immediate stop - set very short release for clean cutoff
        const currentAdsr = { attack: 0.001, decay: 0.05, sustain: 0.5, release: 0.002 };
        this.wasmEngine.set_adsr(currentAdsr.attack, currentAdsr.decay, currentAdsr.sustain, 0.002);
        this.wasmEngine.note_off(midiNote);
        
        // Restore original ADSR after a short delay
        setTimeout(() => {
          // This will be restored on next parameter change anyway
        }, 10);
      } else {
        this.wasmEngine.note_off(midiNote);
      }
    }
  }

  stopAllNotes(): void {
    if (this.wasmEngine) {
      console.log('🔇 Stopping all notes');
      // Send note off for all possible MIDI notes
      for (let i = 0; i < 128; i++) {
        this.wasmEngine.note_off(i);
      }
    }
  }

  // Timeline-specific note methods (use separate engine)
  timelineNoteOn(midiNote: number, velocity: number = 1.0): void {
    if (this.wasmEngine) {
      this.wasmEngine.timeline_note_on(midiNote, velocity);
    }
  }

  timelineNoteOff(midiNote: number): void {
    if (this.wasmEngine) {
      this.wasmEngine.timeline_note_off(midiNote);
    }
  }

  stopAllTimelineNotes(): void {
    if (this.wasmEngine) {
      console.log('🔇 Stopping all timeline notes');
      this.wasmEngine.stop_all_timeline_notes();
    }
  }

  // Volume controls (separate for timeline and live)
  setMasterVolume(volume: number): void {
    if (this.wasmEngine) {
      console.log('🔊 Setting master volume:', volume);
      this.wasmEngine.set_master_volume(volume);
    }
  }

  setTimelineVolume(volume: number): void {
    if (this.wasmEngine) {
      console.log('🔊 Setting timeline volume:', volume);
      this.wasmEngine.set_timeline_volume(volume);
    }
  }

  setLiveVolume(volume: number): void {
    if (this.wasmEngine) {
      console.log('🔊 Setting live volume:', volume);
      this.wasmEngine.set_live_volume(volume);
    }
  }

  setWaveform(waveform: number): void {
    if (this.wasmEngine) {
      const waveformNames = ['Sine', 'Sawtooth', 'Square', 'Triangle', 'FM', 'Piano'];
      console.log('🎼 Setting waveform:', waveformNames[waveform] || waveform);
      this.wasmEngine.set_waveform(waveform);
      this.wasmEngine.set_timeline_waveform(waveform); // Also apply to timeline engine
    }
  }

  setADSR(attack: number, decay: number, sustain: number, release: number): void {
    if (this.wasmEngine) {
      console.log('📊 Setting ADSR:', { attack, decay, sustain, release });
      this.wasmEngine.set_adsr(attack, decay, sustain, release);
      this.wasmEngine.set_timeline_adsr(attack, decay, sustain, release); // Also apply to timeline engine
    }
  }


  setLFORate(rate: number): void {
    if (this.wasmEngine) {
      this.wasmEngine.set_lfo_rate(rate);
      this.wasmEngine.set_timeline_lfo_rate(rate);
    }
  }

  setLFODepth(depth: number): void {
    if (this.wasmEngine) {
      this.wasmEngine.set_lfo_depth(depth);
      this.wasmEngine.set_timeline_lfo_depth(depth);
    }
  }

  setGlideTime(timeMs: number): void {
    if (this.wasmEngine) {
      this.wasmEngine.set_glide_time(timeMs);
      this.wasmEngine.set_timeline_glide_time(timeMs);
    }
  }

  // Effects control
  // ==== RUST-BASED EFFECTS ====
  // All effects are now processed in Rust WASM for maximum performance!

  setTremolo(enabled: boolean, rate: number, depth: number): void {
    if (this.wasmEngine) {
      this.wasmEngine.set_tremolo(enabled, rate, depth);
      this.wasmEngine.set_timeline_tremolo(enabled, rate, depth);
      console.log('🦀 [RUST] Tremolo:', enabled ? 'ON' : 'OFF', 'rate:', rate, 'depth:', depth);
    }
  }

  async setReverb(enabled: boolean, roomSize: number, damping: number): Promise<void> {
    if (this.wasmEngine) {
      this.wasmEngine.set_reverb(enabled, roomSize, damping);
      this.wasmEngine.set_timeline_reverb(enabled, roomSize, damping);
      console.log('🦀 [RUST] Reverb:', enabled ? 'ON' : 'OFF', 'room:', roomSize, 'damping:', damping);
    }
  }

  setDelay(enabled: boolean, time: number, feedback: number, mix: number): void {
    if (this.wasmEngine) {
      const timeMs = time * 1000; // Convert seconds to milliseconds
      this.wasmEngine.set_delay(enabled, timeMs, feedback, mix);
      this.wasmEngine.set_timeline_delay(enabled, timeMs, feedback, mix);
      console.log('🦀 [RUST] Delay:', enabled ? 'ON' : 'OFF', 'time:', timeMs + 'ms', 'feedback:', feedback, 'mix:', mix);
    }
  }

  setBassBoost(_enabled: boolean, _level: number): void {
    console.log('⚠️ Bass Boost not yet implemented in Rust');
  }


  setLFOWaveform(waveform: number): void {
    if (this.wasmEngine) {
      this.wasmEngine.set_lfo_waveform(waveform);
      this.wasmEngine.set_timeline_lfo_waveform(waveform);
      console.log('🦀 [RUST] LFO waveform:', waveform);
    }
  }


  setDetune(cents: number): void {
    if (this.wasmEngine) {
      this.wasmEngine.set_detune(cents);
      this.wasmEngine.set_timeline_detune(cents);
      console.log('🦀 [RUST] Detune:', cents, 'cents');
    }
  }

  // Controla o volume de monitor (saída para as caixas/fone) sem afetar gravação PCM
  setMonitorMuted(muted: boolean): void {
    if (this.monitorGain) {
      this.monitorGain.gain.value = muted ? 0 : 1;
    }
  }

  setFlanger(enabled: boolean, rate: number = 0.5, depth: number = 5, feedback: number = 0.5, mix: number = 0.5): void {
    if (this.wasmEngine) {
      this.wasmEngine.set_flanger(enabled, rate, depth, feedback, mix);
      this.wasmEngine.set_timeline_flanger(enabled, rate, depth, feedback, mix);
      console.log('🦀 [RUST] Flanger:', enabled ? 'ON' : 'OFF');
    }
  }

  async recordToAudioBlob(durationMs: number = 10000): Promise<Blob> {
    if (!this.audioContext || !this.scriptNode) {
      await this.initialize();
    }

    if (!this.audioContext || !this.scriptNode) {
      throw new Error('Audio engine not initialized');
    }

    if (typeof MediaRecorder === 'undefined') {
      throw new Error('MediaRecorder is not supported in this browser');
    }

    const dest = this.audioContext.createMediaStreamDestination();
    this.scriptNode.connect(dest);

    const recorder = new MediaRecorder(dest.stream);
    const chunks: BlobPart[] = [];

    return new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        try {
          this.scriptNode && this.scriptNode.disconnect(dest);
        } catch {}
        reject(new Error('Failed to record audio'));
      };

      recorder.onstop = () => {
        try {
          this.scriptNode && this.scriptNode.disconnect(dest);
        } catch {}
        const blob = new Blob(chunks, { type: 'audio/webm' });
        resolve(blob);
      };

      recorder.start();

      setTimeout(() => {
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      }, durationMs);
    });
  }

  // Exporta um arranjo para WAV em "tempo real controlado" sem afetar o player da UI.
  // Usa timelineNoteOn/Off diretamente a partir de patterns/timeline e grava a saída PCM.
  async exportArrangementSilentlyToWav(
    patterns: Pattern[],
    timeline: TimelineClip[],
    bpm: number,
    extraTailSeconds: number = 1,
  ): Promise<Blob> {
    if (!patterns.length || !timeline.length) {
      const silent = new Float32Array(1);
      const wav = this.encodeWav(silent, 48000);
      return new Blob([wav], { type: 'audio/wav' });
    }

    await this.start();

    if (!this.wasmEngine || !this.audioContext) {
      throw new Error('Audio engine not initialized');
    }

    // Construir eventos absolutos (ms) a partir de patterns/timeline
    const secondsPerBeat = 60 / bpm;

    type OfflineEvent = {
      time: number; // ms absoluto
      type: 'noteOn' | 'noteOff';
      midiNote: number;
      velocity: number;
    };

    const events: OfflineEvent[] = [];
    let maxEndTimeMs = 0;

    // Aplicar parâmetros de síntese capturados na TIMELINE engine, igual à Timeline.tsx
    const waveformMap: Record<string, number> = {
      sine: 0,
      sawtooth: 1,
      square: 2,
      triangle: 3,
      fm: 4,
      piano: 5,
    };

    let appliedParams = false;

    for (const clip of timeline) {
      const pattern = patterns.find((p) => p.id === clip.patternId);
      if (!pattern) continue;

      // Na reprodução normal, cada clip aplica seus capturedParameters na timeline engine
      // Aqui pegamos o primeiro pattern que tiver capturedParameters e aplicamos.
      if (!appliedParams && (pattern as any).capturedParameters && this.wasmEngine) {
        const params = (pattern as any).capturedParameters;
        const wasm = this.wasmEngine;

        try {
          const wfIndex = waveformMap[params.waveform] ?? 0;
          if (wasm.set_timeline_waveform) wasm.set_timeline_waveform(wfIndex);
          if (wasm.set_timeline_adsr) wasm.set_timeline_adsr(
            params.adsr.attack,
            params.adsr.decay,
            params.adsr.sustain,
            params.adsr.release,
          );
          if (wasm.set_timeline_lfo_rate) wasm.set_timeline_lfo_rate(params.lfo.rate);
          if (wasm.set_timeline_lfo_depth) wasm.set_timeline_lfo_depth(params.lfo.depth);
          if (wasm.set_timeline_lfo_waveform) wasm.set_timeline_lfo_waveform(params.lfo.waveform);
          if (wasm.set_timeline_detune) wasm.set_timeline_detune(params.detune);

          if (params.effects) {
            const effects = params.effects;
            if (wasm.set_timeline_glide_time) wasm.set_timeline_glide_time(effects.glide?.enabled ? effects.glide.time : 0);
            if (wasm.set_timeline_tremolo) wasm.set_timeline_tremolo(
              effects.tremolo?.enabled,
              effects.tremolo?.rate,
              effects.tremolo?.depth,
            );
            if (wasm.set_timeline_flanger) wasm.set_timeline_flanger(
              effects.flanger?.enabled,
              effects.flanger?.rate,
              effects.flanger?.depth,
              effects.flanger?.feedback,
              effects.flanger?.mix,
            );
            if (wasm.set_timeline_delay) wasm.set_timeline_delay(
              effects.delay?.enabled,
              effects.delay?.time,
              effects.delay?.feedback,
              effects.delay?.mix,
            );
            if (wasm.set_timeline_reverb) wasm.set_timeline_reverb(
              effects.reverb?.enabled,
              effects.reverb?.size,
              effects.reverb?.damping,
            );
          }
        } catch (e) {
          console.warn('Failed to apply capturedParameters to timeline engine for export:', e);
        }

        appliedParams = true;
      }

      const clipStartMs = clip.startTime * secondsPerBeat * 1000;

      for (const note of pattern.notes) {
        const absoluteTime = clipStartMs + note.time;
        events.push({
          time: absoluteTime,
          type: note.type,
          midiNote: note.midiNote,
          velocity: note.velocity,
        });
        if (absoluteTime > maxEndTimeMs) {
          maxEndTimeMs = absoluteTime;
        }
      }
    }

    if (!events.length) {
      const silent = new Float32Array(1);
      const wav = this.encodeWav(silent, this.audioContext.sampleRate || 48000);
      return new Blob([wav], { type: 'audio/wav' });
    }

    events.sort((a, b) => a.time - b.time);

    const totalDurationMs = maxEndTimeMs + extraTailSeconds * 1000;

    // Mutar o monitor para não tocar nas caixas durante a exportação
    this.setMonitorMuted(true);

    // Limpar notas pendentes por segurança
    this.stopAllTimelineNotes();

    // Iniciar gravação PCM
    this.startWavRecording();

    // Agendar eventos usando setTimeout relativo ao início do arranjo
    const timeouts: number[] = [];

    for (const ev of events) {
      const delay = Math.max(0, ev.time - 0); // ev.time já é relativo ao início do arranjo
      const id = window.setTimeout(() => {
        if (!this.wasmEngine) return;
        if (ev.type === 'noteOn') {
          this.timelineNoteOn(ev.midiNote, ev.velocity);
        } else {
          this.timelineNoteOff(ev.midiNote);
        }
      }, delay);
      timeouts.push(id);
    }

    // Esperar até o fim do arranjo + cauda
    await new Promise<void>((resolve) => {
      const id = window.setTimeout(() => resolve(), totalDurationMs);
      timeouts.push(id);
    });

    // Garantir que nenhuma nota fique presa
    this.stopAllTimelineNotes();

    // Cancelar timeouts restantes por segurança
    for (const id of timeouts) {
      clearTimeout(id);
    }

    const blob = this.stopWavRecording(this.audioContext.sampleRate);

    // Restaurar monitor
    this.setMonitorMuted(false);

    return blob;
  }

  startWavRecording(): void {
    this.pcmBuffers = [];
    this.isPcmRecording = true;
  }

  stopWavRecording(sampleRateOverride?: number): Blob {
    this.isPcmRecording = false;

    if (!this.audioContext) {
      throw new Error('AudioContext not available');
    }

    const sampleRate = sampleRateOverride || this.audioContext.sampleRate;
    let totalLength = 0;
    for (let i = 0; i < this.pcmBuffers.length; i++) {
      totalLength += this.pcmBuffers[i].length;
    }

    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (let i = 0; i < this.pcmBuffers.length; i++) {
      merged.set(this.pcmBuffers[i], offset);
      offset += this.pcmBuffers[i].length;
    }

    const wavBuffer = this.encodeWav(merged, sampleRate);
    this.pcmBuffers = [];
    return new Blob([wavBuffer], { type: 'audio/wav' });
  }

  private encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
    const bytesPerSample = 2;
    const numChannels = 1;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = samples.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    let offset = 0;

    const writeString = (s: string) => {
      for (let i = 0; i < s.length; i++) {
        view.setUint8(offset++, s.charCodeAt(i));
      }
    };

    writeString('RIFF');
    view.setUint32(offset, 36 + dataSize, true);
    offset += 4;
    writeString('WAVE');
    writeString('fmt ');
    view.setUint32(offset, 16, true);
    offset += 4;
    view.setUint16(offset, 1, true);
    offset += 2;
    view.setUint16(offset, numChannels, true);
    offset += 2;
    view.setUint32(offset, sampleRate, true);
    offset += 4;
    view.setUint32(offset, byteRate, true);
    offset += 4;
    view.setUint16(offset, blockAlign, true);
    offset += 2;
    view.setUint16(offset, bytesPerSample * 8, true);
    offset += 2;
    writeString('data');
    view.setUint32(offset, dataSize, true);
    offset += 4;

    for (let i = 0; i < samples.length; i++, offset += 2) {
      let s = samples[i];
      if (s < -1) s = -1;
      if (s > 1) s = 1;
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    return buffer;
  }

  dispose(): void {
    if (this.scriptNode) {
      this.scriptNode.disconnect();
      this.scriptNode.onaudioprocess = null;
      this.scriptNode = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.wasmEngine = null;
    this.isInitialized = false;
  }

  async renderPatternOfflineToWav(pattern: Pattern, durationSeconds?: number): Promise<Blob> {
    if (!this.wasmModule) {
      await this.initialize();
    }

    if (!this.wasmModule) {
      throw new Error('WASM module not available');
    }

    const OfflineEngineConstructor = this.wasmModule.AudioEngine;
    const offlineEngine = new OfflineEngineConstructor();

    // Ensure basic parameters are set for audible output
    try {
      offlineEngine.set_master_volume(1.0);
      if (offlineEngine.set_timeline_volume) {
        offlineEngine.set_timeline_volume(1.0);
      }
      if (offlineEngine.set_live_volume) {
        offlineEngine.set_live_volume(1.0);
      }
      // Default to sine + simple ADSR if not overridden elsewhere
      if (offlineEngine.set_waveform) {
        offlineEngine.set_waveform(0);
      }
      if (offlineEngine.set_timeline_waveform) {
        offlineEngine.set_timeline_waveform(0);
      }
      if (offlineEngine.set_adsr) {
        offlineEngine.set_adsr(0.01, 0.2, 1.0, 0.3);
      }
      if (offlineEngine.set_timeline_adsr) {
        offlineEngine.set_timeline_adsr(0.01, 0.2, 1.0, 0.3);
      }
    } catch (e) {
      console.warn('Offline pattern engine parameter init failed:', e);
    }

    let sampleRate = 48000;
    try {
      const sr = offlineEngine.get_sample_rate();
      if (typeof sr === 'number' && sr > 0) {
        sampleRate = sr;
      }
    } catch {}

    const lengthSeconds = durationSeconds ?? (pattern.length || 8) + 1;
    const totalSamples = Math.ceil(lengthSeconds * sampleRate);
    const bufferSize = this.bufferSize;

    const notes = [...pattern.notes].sort((a: RecordedNote, b: RecordedNote) => a.time - b.time);
    let noteIndex = 0;

    const allSamples = new Float32Array(totalSamples);
    let currentSample = 0;

    while (currentSample < totalSamples) {
      const remaining = totalSamples - currentSample;
      const blockSize = remaining < bufferSize ? remaining : bufferSize;

      while (noteIndex < notes.length) {
        const note = notes[noteIndex];
        const noteSample = Math.round((note.time / 1000) * sampleRate);
        if (noteSample >= currentSample + blockSize) {
          break;
        }
        if (noteSample >= currentSample) {
          if (note.type === 'noteOn') {
            offlineEngine.note_on(note.midiNote, note.velocity);
          } else {
            offlineEngine.note_off(note.midiNote);
          }
        }
        noteIndex++;
      }

      const block = new Float32Array(blockSize);
      offlineEngine.process(block);
      allSamples.set(block, currentSample);
      currentSample += blockSize;
    }

    const wavBuffer = this.encodeWav(allSamples, sampleRate);
    return new Blob([wavBuffer], { type: 'audio/wav' });
  }

  async renderArrangementOfflineToWav(
    patterns: Pattern[],
    timeline: TimelineClip[],
    bpm: number,
    extraTailSeconds: number = 1
  ): Promise<Blob> {
    if (!this.wasmModule) {
      await this.initialize();
    }

    if (!this.wasmModule) {
      throw new Error('WASM module not available');
    }

    if (!patterns.length || !timeline.length) {
      // Nothing to render, return short silent WAV
      const silent = new Float32Array(1);
      const wav = this.encodeWav(silent, 48000);
      return new Blob([wav], { type: 'audio/wav' });
    }

    const OfflineEngineConstructor = this.wasmModule.AudioEngine;
    const offlineEngine = new OfflineEngineConstructor();

    let sampleRate = 48000;
    try {
      const sr = offlineEngine.get_sample_rate();
      if (typeof sr === 'number' && sr > 0) {
        sampleRate = sr;
      }
    } catch {}

    const secondsPerBeat = 60 / bpm;

    type OfflineEvent = {
      time: number; // ms absolute
      type: 'noteOn' | 'noteOff';
      midiNote: number;
      velocity: number;
    };

    const events: OfflineEvent[] = [];
    let maxEndTimeMs = 0;

    for (const clip of timeline) {
      const pattern = patterns.find(p => p.id === clip.patternId);
      if (!pattern) continue;

      const clipStartMs = clip.startTime * secondsPerBeat * 1000;

      for (const note of pattern.notes) {
        const absoluteTime = clipStartMs + note.time;
        events.push({
          time: absoluteTime,
          type: note.type,
          midiNote: note.midiNote,
          velocity: note.velocity,
        });
        if (absoluteTime > maxEndTimeMs) {
          maxEndTimeMs = absoluteTime;
        }
      }
    }

    if (!events.length) {
      const silent = new Float32Array(1);
      const wav = this.encodeWav(silent, sampleRate);
      return new Blob([wav], { type: 'audio/wav' });
    }

    events.sort((a, b) => a.time - b.time);

    const totalSeconds = maxEndTimeMs / 1000 + extraTailSeconds;
    const totalSamples = Math.ceil(totalSeconds * sampleRate);
    const bufferSize = this.bufferSize;

    const allSamples = new Float32Array(totalSamples);
    let currentSample = 0;
    let eventIndex = 0;

    while (currentSample < totalSamples) {
      const remaining = totalSamples - currentSample;
      const blockSize = remaining < bufferSize ? remaining : bufferSize;

      const blockStartTimeMs = (currentSample / sampleRate) * 1000;
      const blockEndTimeMs = ((currentSample + blockSize) / sampleRate) * 1000;

      while (eventIndex < events.length) {
        const ev = events[eventIndex];
        if (ev.time >= blockEndTimeMs) break;
        if (ev.time >= blockStartTimeMs) {
          if (ev.type === 'noteOn') {
            offlineEngine.note_on(ev.midiNote, ev.velocity);
          } else {
            offlineEngine.note_off(ev.midiNote);
          }
        }
        eventIndex++;
      }

      const block = new Float32Array(blockSize);
      offlineEngine.process(block);
      allSamples.set(block, currentSample);
      currentSample += blockSize;
    }

    const wavBuffer = this.encodeWav(allSamples, sampleRate);
    return new Blob([wavBuffer], { type: 'audio/wav' });
  }
}

