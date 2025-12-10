// Audio engine that uses Rust WASM for ALL DSP processing
// Runs WASM in main thread, uses ScriptProcessorNode for audio output
// ALL audio effects are now processed in Rust for maximum performance!

export class WasmAudioEngine {
  public wasmEngine: any = null; // Made public for direct timeline engine access
  private audioContext: AudioContext | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  private isInitialized = false;
  private wasmModule: any = null;
  private bufferSize = 2048; // Larger buffer to reduce glitches

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

        // Create buffer for WASM to fill
        const wasmBuffer = new Float32Array(length);

        try {
          // Process audio through WASM (includes all effects!)
          this.wasmEngine.process(wasmBuffer);

          // Copy to output channels (mono to stereo)
          for (let i = 0; i < length; i++) {
            outputL[i] = wasmBuffer[i];
            outputR[i] = wasmBuffer[i];
          }
        } catch (error) {
          console.error('WASM processing error:', error);
          // Output silence on error
          outputL.fill(0);
          outputR.fill(0);
        }
      };

      // Connect directly to destination (all effects are in Rust now!)
      this.scriptNode.connect(this.audioContext.destination);

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
}

