// Helper to load AudioWorklet processor as a blob URL
// This avoids Vite transformation issues

export async function loadWorkletProcessor(audioContext: AudioContext): Promise<void> {
  // Import the processor code as text
  const processorCode = `
// AudioWorkletProcessor must be a .js file
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
        if (!this.initPromise && event.data.wasmBinaryUrl) {
          this.initPromise = this.initializeWASM(event.data.wasmBinaryUrl);
        }
        await this.initPromise;
      } else if (event.data.type === 'parameter') {
        if (this.wasmEngine && event.data.param) {
          const { name, value } = event.data.param;
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
        } else {
          console.warn('noteOn received but WASM engine not ready');
        }
      } else if (event.data.type === 'noteOff') {
        if (this.wasmEngine) {
          this.wasmEngine.note_off(event.data.midiNote);
        } else {
          console.warn('noteOff received but WASM engine not ready');
        }
      }
    };
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    
    if (!output || output.length === 0) {
      return true;
    }
    
    if (!this.wasmEngine) {
      // Output silence if not initialized
      for (let channel = 0; channel < output.length; channel++) {
        for (let i = 0; i < output[channel].length; i++) {
          output[channel][i] = 0;
        }
      }
      return true;
    }

    const bufferLength = output[0].length;
    this.buffer = new Float32Array(bufferLength);
    
    try {
      this.wasmEngine.process(this.buffer);
      
      // Check if we have any audio (for debugging)
      let hasAudio = false;
      for (let i = 0; i < bufferLength; i++) {
        if (Math.abs(this.buffer[i]) > 0.001) {
          hasAudio = true;
          break;
        }
      }
      
      for (let i = 0; i < bufferLength; i++) {
        output[0][i] = this.buffer[i];
        if (output[1]) {
          output[1][i] = this.buffer[i];
        }
      }
    } catch (error) {
      console.error('WASM processing error:', error);
      // Output silence on error
      for (let channel = 0; channel < output.length; channel++) {
        for (let i = 0; i < output[channel].length; i++) {
          output[channel][i] = 0;
        }
      }
    }

    return true;
  }

  async initializeWASM(wasmBinaryUrl) {
    if (this.initializing || this.wasmEngine) {
      return;
    }
    
    this.initializing = true;
    
    try {
      console.log('Loading WASM from:', wasmBinaryUrl);
      
      // Fetch the WASM binary
      const response = await fetch(wasmBinaryUrl);
      const wasmBytes = await response.arrayBuffer();
      
      console.log('WASM binary loaded, size:', wasmBytes.byteLength);
      
      // Instantiate WASM
      const wasmModule = await WebAssembly.instantiate(wasmBytes, {
        ./rust_dsp_bg.js: {
          __wbg_log_1a7e8b66a4ca53a5: (ptr, len) => {
            console.log('WASM log');
          },
          __wbindgen_throw: (ptr, len) => {
            throw new Error('WASM error');
          }
        }
      });
      
      console.log('WASM instantiated');
      
      // Get exports
      const exports = wasmModule.instance.exports;
      
      // Create a wrapper for the AudioEngine
      // The WASM exports functions directly, we need to call them
      this.wasmEngine = {
        memory: exports.memory,
        process: (buffer) => {
          // Call WASM process function
          const ptr = exports.__wbindgen_malloc(buffer.length * 4);
          const wasmBuffer = new Float32Array(exports.memory.buffer, ptr, buffer.length);
          
          // Would need to call the actual process function here
          // This is a simplified version - needs proper WASM bindings
          
          exports.__wbindgen_free(ptr, buffer.length * 4);
        },
        note_on: exports.note_on || ((note, vel) => {}),
        note_off: exports.note_off || ((note) => {}),
        set_master_volume: exports.set_master_volume || ((vol) => {}),
        set_waveform: exports.set_waveform || ((wf) => {}),
        set_adsr: exports.set_adsr || ((a,d,s,r) => {}),
        set_filter_cutoff: exports.set_filter_cutoff || ((cutoff) => {}),
        set_filter_resonance: exports.set_filter_resonance || ((res) => {}),
        set_lfo_rate: exports.set_lfo_rate || ((rate) => {}),
        set_lfo_depth: exports.set_lfo_depth || ((depth) => {})
      };
      
      console.log('WASM engine wrapper created');
      this.port.postMessage({ type: 'wasmReady' });
    } catch (error) {
      console.error('Failed to initialize WASM in worklet:', error);
      this.port.postMessage({ type: 'wasmError', error: error.message });
    } finally {
      this.initializing = false;
    }
  }
}

try {
  registerProcessor('audio-processor', AudioProcessor);
} catch (error) {
  console.error('Failed to register AudioWorklet processor:', error);
  throw error;
}
`;

  // Create a blob URL from the processor code
  const blob = new Blob([processorCode], { type: 'application/javascript' });
  const blobUrl = URL.createObjectURL(blob);

  try {
    await audioContext.audioWorklet.addModule(blobUrl);
  } finally {
    // Clean up the blob URL after loading
    URL.revokeObjectURL(blobUrl);
  }
}

