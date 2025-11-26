use wasm_bindgen::prelude::*;

mod oscillator;
mod envelope;
mod filter;
mod voice;
mod lfo;
mod effects;

use filter::StateVariableFilter;
use voice::Voice;
use lfo::Lfo;
use effects::delay::Delay;
use effects::reverb::Reverb;
use effects::tremolo::Tremolo;
use effects::flanger::Flanger;

const SAMPLE_RATE: f32 = 48000.0;
const MAX_VOICES: usize = 10;

#[wasm_bindgen]
pub struct AudioEngine {
    voices: Vec<Voice>,
    master_volume: f32,
    lfo: Lfo,
    filter: StateVariableFilter,
    filter_mode: u8, // 0=lowpass, 1=highpass, 2=bandpass
    filter_enabled: bool,
    // Rust-based effects
    delay: Delay,
    reverb: Reverb,
    tremolo: Tremolo,
    flanger: Flanger,
    // Effect enables
    delay_enabled: bool,
    reverb_enabled: bool,
    tremolo_enabled: bool,
    flanger_enabled: bool,
    // LFO modulation settings
    lfo_to_filter: bool,
    base_filter_cutoff: f32,
    // Detune
    detune_cents: f32,
}

#[wasm_bindgen]
impl AudioEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> AudioEngine {
        let mut voices = Vec::with_capacity(MAX_VOICES);
        for _ in 0..MAX_VOICES {
            voices.push(Voice::new(SAMPLE_RATE));
        }

        AudioEngine {
            voices,
            master_volume: 0.21, // 70% of 0.3 max
            lfo: Lfo::new(SAMPLE_RATE),
            filter: StateVariableFilter::new(SAMPLE_RATE),
            filter_mode: 0,
            filter_enabled: false,
            // Initialize effects
            delay: Delay::new(SAMPLE_RATE, 2000.0),
            reverb: Reverb::new(SAMPLE_RATE),
            tremolo: Tremolo::new(SAMPLE_RATE),
            flanger: Flanger::new(SAMPLE_RATE),
            // Effects disabled by default
            delay_enabled: false,
            reverb_enabled: false,
            tremolo_enabled: false,
            flanger_enabled: false,
            // LFO modulation disabled by default
            lfo_to_filter: false,
            base_filter_cutoff: 20000.0,
            detune_cents: 0.0,
        }
    }

    pub fn process(&mut self, output: &mut [f32]) {
        let len = output.len();
        let mut buffer = vec![0.0; len];

        // Process all active voices
        for voice in &mut self.voices {
            if voice.is_active() {
                voice.process(&mut buffer);
            }
        }

        // Process each sample through effects chain
        for i in 0..len {
            let mut sample = buffer[i];

            // Apply LFO modulation to filter cutoff if enabled
            if self.lfo_to_filter {
                let lfo_value = self.lfo.process();
                let modulated_cutoff = self.base_filter_cutoff * (1.0 + lfo_value);
                self.filter.set_cutoff(modulated_cutoff.clamp(20.0, 20000.0));
            }

            // Apply filter with mode selection (only if enabled)
            if self.filter_enabled {
                sample = match self.filter_mode {
                    1 => self.filter.process_highpass(sample),
                    2 => self.filter.process_bandpass(sample),
                    _ => self.filter.process(sample), // 0 = lowpass (default)
                };
            }

            // Apply flanger
            if self.flanger_enabled {
                sample = self.flanger.process(sample);
            }

            // Apply tremolo (amplitude modulation)
            if self.tremolo_enabled {
                sample = self.tremolo.process(sample);
            }

            // Apply delay
            if self.delay_enabled {
                sample = self.delay.process(sample);
            }

            // Apply reverb
            if self.reverb_enabled {
                sample = self.reverb.process(sample);
            }

            // Apply master volume
            buffer[i] = sample * self.master_volume;
        }

        // Write to output
        output.copy_from_slice(&buffer);
    }

    pub fn note_on(&mut self, midi_note: u8, velocity: f32) {
        // Find free voice or steal oldest
        let mut voice_idx = None;
        for (i, voice) in self.voices.iter().enumerate() {
            if !voice.is_active() {
                voice_idx = Some(i);
                break;
            }
        }

        if voice_idx.is_none() {
            // Voice stealing - find oldest voice
            let mut oldest_time = f32::MAX;
            for (i, voice) in self.voices.iter().enumerate() {
                if voice.get_age() < oldest_time {
                    oldest_time = voice.get_age();
                    voice_idx = Some(i);
                }
            }
        }

        if let Some(idx) = voice_idx {
            let freq = midi_to_freq(midi_note);
            self.voices[idx].note_on(freq, velocity);
        }
    }

    pub fn note_off(&mut self, midi_note: u8) {
        let freq = midi_to_freq(midi_note);
        for voice in &mut self.voices {
            if (voice.get_frequency() - freq).abs() < 0.1 {
                voice.note_off();
            }
        }
    }

    pub fn set_master_volume(&mut self, volume: f32) {
        // Scale input 0-1 to output 0-0.3 (30% max to prevent clipping/distortion)
        self.master_volume = (volume * 0.3).clamp(0.0, 0.3);
    }

    pub fn set_waveform(&mut self, waveform: u8) {
        for voice in &mut self.voices {
            voice.set_waveform(waveform);
        }
    }

    pub fn set_adsr(&mut self, attack: f32, decay: f32, sustain: f32, release: f32) {
        for voice in &mut self.voices {
            voice.set_adsr(attack, decay, sustain, release);
        }
    }

    pub fn set_filter_cutoff(&mut self, cutoff: f32) {
        self.base_filter_cutoff = cutoff;
        self.filter.set_cutoff(cutoff);
    }

    pub fn set_filter_resonance(&mut self, resonance: f32) {
        self.filter.set_resonance(resonance);
    }

    pub fn set_filter_mode(&mut self, mode: u8) {
        self.filter_mode = mode.min(2); // 0=lowpass, 1=highpass, 2=bandpass
    }

    pub fn set_filter_enabled(&mut self, enabled: bool) {
        self.filter_enabled = enabled;
    }

    pub fn set_lfo_rate(&mut self, rate: f32) {
        self.lfo.set_rate(rate);
    }

    pub fn set_lfo_depth(&mut self, depth: f32) {
        self.lfo.set_depth(depth);
    }

    pub fn set_lfo_waveform(&mut self, waveform: u8) {
        self.lfo.set_waveform(waveform);
    }

    pub fn set_lfo_to_filter(&mut self, enabled: bool) {
        self.lfo_to_filter = enabled;
    }

    pub fn set_detune(&mut self, cents: f32) {
        self.detune_cents = cents;
        for voice in &mut self.voices {
            voice.set_detune(cents);
        }
    }

    pub fn set_glide_time(&mut self, time_ms: f32) {
        for voice in &mut self.voices {
            voice.set_glide_time(time_ms);
        }
    }

    // ==== RUST EFFECTS CONTROL ====

    pub fn set_delay(&mut self, enabled: bool, time_ms: f32, feedback: f32, mix: f32) {
        self.delay_enabled = enabled;
        if enabled {
            self.delay.set_delay_time(time_ms);
            self.delay.set_feedback(feedback);
            self.delay.set_mix(mix);
        }
    }

    pub fn set_reverb(&mut self, enabled: bool, room_size: f32, damping: f32) {
        self.reverb_enabled = enabled;
        if enabled {
            self.reverb.set_room_size(room_size);
            self.reverb.set_damping(damping);
        }
    }

    pub fn set_tremolo(&mut self, enabled: bool, rate: f32, depth: f32) {
        self.tremolo_enabled = enabled;
        if enabled {
            self.tremolo.set_rate(rate);
            self.tremolo.set_depth(depth);
        }
    }

    pub fn set_flanger(&mut self, enabled: bool, rate: f32, depth: f32, feedback: f32, mix: f32) {
        self.flanger_enabled = enabled;
        if enabled {
            self.flanger.set_lfo_rate(rate);
            self.flanger.set_delay_range(depth);
            self.flanger.set_feedback(feedback);
            self.flanger.set_mix(mix);
        }
    }

    pub fn get_sample_rate(&self) -> f32 {
        SAMPLE_RATE
    }
}

fn midi_to_freq(midi: u8) -> f32 {
    440.0 * 2.0_f32.powf((midi as f32 - 69.0) / 12.0)
}

