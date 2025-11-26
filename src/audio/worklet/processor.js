// AudioWorkletProcessor must be a .js file
// Ensure AudioWorkletProcessor is available
if (typeof AudioWorkletProcessor === 'undefined') {
  throw new Error('AudioWorkletProcessor is not available in this context');
}

class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(128);
    this.wasmEngine = null;
    this.wasmModule = null;
    this.initializing = false;
    this.initPromise = null;
    
    this.port.onmessage = async (event) => {
      if (event.data.type === 'init') {
        // Initialize WASM in worklet - load it directly here
        if (!this.initPromise && event.data.wasmUrl) {
          this.initPromise = this.initializeWASM(event.data.wasmUrl);
        }
        await this.initPromise;
      } else if (event.data.type === 'parameter') {
        // Handle parameter updates
        if (this.wasmEngine && event.data.param) {
          const { name, value } = event.data.param;
          // Update WASM engine parameters
          switch (name) {
            case 'masterVolume':
              this.wasmEngine.set_master_volume(value);
              break;
            case 'waveform':
              this.wasmEngine.set_waveform(value);
              break;
            case 'adsr':
              this.wasmEngine.set_adsr(value.attack, value.decay, value.sustain, value.release);
              break;
            case 'filterCutoff':
              this.wasmEngine.set_filter_cutoff(value);
              break;
            case 'filterResonance':
              this.wasmEngine.set_filter_resonance(value);
              break;
            case 'lfoRate':
              this.wasmEngine.set_lfo_rate(value);
              break;
            case 'lfoDepth':
              this.wasmEngine.set_lfo_depth(value);
              break;
          }
        }
      } else if (event.data.type === 'noteOn') {
        if (this.wasmEngine) {
          this.wasmEngine.note_on(event.data.midiNote, event.data.velocity || 1.0);
        }
      } else if (event.data.type === 'noteOff') {
        if (this.wasmEngine) {
          this.wasmEngine.note_off(event.data.midiNote);
        }
      }
    };
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    
    if (!this.wasmEngine || !output || output.length === 0) {
      // Output silence if not initialized
      for (let channel = 0; channel < output.length; channel++) {
        for (let i = 0; i < output[channel].length; i++) {
          output[channel][i] = 0;
        }
      }
      return true;
    }

    // Process audio through WASM engine
    const bufferLength = output[0].length;
    this.buffer = new Float32Array(bufferLength);
    
    try {
      this.wasmEngine.process(this.buffer);
      
      // Copy to output channels (stereo)
      for (let i = 0; i < bufferLength; i++) {
        output[0][i] = this.buffer[i];
        if (output[1]) {
          output[1][i] = this.buffer[i];
        }
      }
    } catch (error) {
      console.error('WASM processing error:', error);
    }

    return true;
  }

  async initializeWASM(wasmUrl) {
    if (this.initializing || this.wasmEngine) {
      return;
    }
    
    this.initializing = true;
    
    try {
      // Load WASM module using the URL passed from main thread
      // @ts-ignore - Vite can't analyze dynamic imports in worklets
      this.wasmModule = await import(/* @vite-ignore */ wasmUrl);
      
      // Initialize WASM
      if (this.wasmModule.default) {
        await this.wasmModule.default();
      }
      
      // Create WASM engine
      if (this.wasmModule.AudioEngine) {
        this.wasmEngine = new this.wasmModule.AudioEngine();
      }
      
      this.port.postMessage({ type: 'wasmReady' });
    } catch (error) {
      console.error('Failed to initialize WASM in worklet:', error);
      this.port.postMessage({ type: 'wasmError', error: error.message });
    } finally {
      this.initializing = false;
    }
  }
}

// Register the processor
try {
  registerProcessor('audio-processor', AudioProcessor);
} catch (error) {
  console.error('Failed to register AudioWorklet processor:', error);
  throw error;
}

