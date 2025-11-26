import { loadWorkletProcessor } from './worklet-processor-loader';

export class AudioEngine {
  private wasmEngine: any = null;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private isInitialized = false;
  private wasmModule: any = null;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Load WASM module
      // @ts-ignore - Dynamic WASM import
      this.wasmModule = await import('./wasm/rust_dsp.js');
      await this.wasmModule.default();
      
      // Create AudioContext
      this.audioContext = new AudioContext({
        sampleRate: 48000,
        latencyHint: 'interactive',
      });

      // Load AudioWorklet processor using blob URL approach
      try {
        await loadWorkletProcessor(this.audioContext);
      } catch (error) {
        console.error('Failed to load AudioWorklet processor:', error);
        throw new Error(`Failed to load AudioWorklet: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Create AudioWorkletNode
      try {
        this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-processor', {
          numberOfInputs: 0,
          numberOfOutputs: 1,
          outputChannelCount: [2],
        });
      } catch (error) {
        console.error('Failed to create AudioWorkletNode:', error);
        throw new Error(`Failed to create AudioWorkletNode: ${error instanceof Error ? error.message : String(error)}. Make sure the processor is registered.`);
      }

      // Get the WASM file URL (not the .js wrapper)
      const wasmBinaryUrl = new URL('./wasm/rust_dsp_bg.wasm', import.meta.url).href;
      const wasmJsUrl = new URL('./wasm/rust_dsp.js', import.meta.url).href;
      
      // Listen for messages from worklet
      this.workletNode.port.onmessage = (event) => {
        if (event.data.type === 'wasmReady') {
          console.log('WASM engine initialized in worklet');
        } else if (event.data.type === 'wasmError') {
          console.error('WASM initialization error in worklet:', event.data.error);
        }
      };
      
      // Send init message to worklet with WASM URLs
      this.workletNode.port.postMessage({
        type: 'init',
        wasmBinaryUrl: wasmBinaryUrl,
        wasmJsUrl: wasmJsUrl,
      });

      // Create WASM engine in main thread for parameter control
      this.wasmEngine = new this.wasmModule.AudioEngine();
      
      // Set initial parameters
      this.wasmEngine.set_master_volume(0.7);
      this.wasmEngine.set_waveform(0); // Sine wave
      this.wasmEngine.set_adsr(0.08, 0.6, 0.5, 3.0);
      
      // Also send initial parameters to worklet
      this.setMasterVolume(0.7);
      this.setWaveform(0);
      this.setADSR(0.08, 0.6, 0.5, 3.0);
      
      console.log('Audio engine initialized');

      // Connect to destination
      this.workletNode.connect(this.audioContext.destination);

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize audio engine:', error);
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
    console.log('noteOn:', midiNote, velocity);
    // Send to worklet for audio thread processing
    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: 'noteOn',
        midiNote,
        velocity,
      });
    } else {
      console.warn('Worklet node not available');
    }
    // Also update main thread engine for parameter queries
    if (this.wasmEngine) {
      this.wasmEngine.note_on(midiNote, velocity);
    } else {
      console.warn('WASM engine not available');
    }
  }

  noteOff(midiNote: number): void {
    // Send to worklet for audio thread processing
    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: 'noteOff',
        midiNote,
      });
    }
    // Also update main thread engine
    if (this.wasmEngine) {
      this.wasmEngine.note_off(midiNote);
    }
  }

  setMasterVolume(volume: number): void {
    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: 'parameter',
        param: { name: 'masterVolume', value: volume },
      });
    }
    if (this.wasmEngine) {
      this.wasmEngine.set_master_volume(volume);
    }
  }

  setWaveform(waveform: number): void {
    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: 'parameter',
        param: { name: 'waveform', value: waveform },
      });
    }
    if (this.wasmEngine) {
      this.wasmEngine.set_waveform(waveform);
    }
  }

  setADSR(attack: number, decay: number, sustain: number, release: number): void {
    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: 'parameter',
        param: { name: 'adsr', value: { attack, decay, sustain, release } },
      });
    }
    if (this.wasmEngine) {
      this.wasmEngine.set_adsr(attack, decay, sustain, release);
    }
  }

  setFilterCutoff(cutoff: number): void {
    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: 'parameter',
        param: { name: 'filterCutoff', value: cutoff },
      });
    }
    if (this.wasmEngine) {
      this.wasmEngine.set_filter_cutoff(cutoff);
    }
  }

  setFilterResonance(resonance: number): void {
    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: 'parameter',
        param: { name: 'filterResonance', value: resonance },
      });
    }
    if (this.wasmEngine) {
      this.wasmEngine.set_filter_resonance(resonance);
    }
  }

  setLFORate(rate: number): void {
    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: 'parameter',
        param: { name: 'lfoRate', value: rate },
      });
    }
    if (this.wasmEngine) {
      this.wasmEngine.set_lfo_rate(rate);
    }
  }

  setLFODepth(depth: number): void {
    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: 'parameter',
        param: { name: 'lfoDepth', value: depth },
      });
    }
    if (this.wasmEngine) {
      this.wasmEngine.set_lfo_depth(depth);
    }
  }

  getWasmEngine(): any {
    return this.wasmEngine;
  }

  dispose(): void {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.wasmEngine = null;
    this.isInitialized = false;
  }
}

