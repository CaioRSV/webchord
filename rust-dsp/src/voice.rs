use crate::oscillator::Oscillator;
use crate::envelope::Envelope;
use crate::effects::glide::Glide;

pub struct Voice {
    oscillator: Oscillator,
    envelope: Envelope,
    glide: Glide,
    active: bool,
    age: f32,
    velocity: f32,
}

impl Voice {
    pub fn new(sample_rate: f32) -> Self {
        Voice {
            oscillator: Oscillator::new(sample_rate),
            envelope: Envelope::new(sample_rate),
            glide: Glide::new(sample_rate),
            active: false,
            age: 0.0,
            velocity: 1.0,
        }
    }

    pub fn note_on(&mut self, frequency: f32, velocity: f32) {
        // Use glide for smooth frequency transitions
        self.glide.set_target(frequency);
        
        // Only reset phase if this is a new note (not retriggering)
        if !self.active {
            self.oscillator.reset_phase();
        }
        
        self.velocity = velocity;
        self.envelope.gate_on();
        self.active = true;
        self.age = 0.0;
    }

    pub fn note_off(&mut self) {
        self.envelope.gate_off();
    }

    pub fn process(&mut self, output: &mut [f32]) {
        if !self.active && !self.envelope.is_active() {
            return;
        }

        self.age += 1.0;

        for sample in output.iter_mut() {
            // Process glide and update oscillator frequency
            let current_freq = self.glide.process();
            self.oscillator.set_frequency(current_freq);
            
            let osc_out = self.oscillator.process();
            let env_out = self.envelope.process();
            *sample += osc_out * env_out * self.velocity;

            if !self.envelope.is_active() {
                self.active = false;
            }
        }
    }

    pub fn is_active(&self) -> bool {
        self.active || self.envelope.is_active()
    }

    pub fn set_waveform(&mut self, waveform: u8) {
        self.oscillator.set_waveform(waveform);
    }

    pub fn set_adsr(&mut self, attack: f32, decay: f32, sustain: f32, release: f32) {
        self.envelope.set_adsr(attack, decay, sustain, release);
    }

    pub fn get_frequency(&self) -> f32 {
        self.glide.get_frequency()
    }

    pub fn get_age(&self) -> f32 {
        self.age
    }

    pub fn set_glide_time(&mut self, time_ms: f32) {
        self.glide.set_glide_time(time_ms);
    }

    pub fn set_detune(&mut self, cents: f32) {
        self.oscillator.set_detune(cents);
    }
}

