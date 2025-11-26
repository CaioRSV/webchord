#[derive(Clone, Copy, PartialEq)]
pub enum EnvelopeStage {
    Idle,
    Attack,
    Decay,
    Sustain,
    Release,
}

pub struct Envelope {
    stage: EnvelopeStage,
    value: f32,
    attack_time: f32,
    decay_time: f32,
    sustain_level: f32,
    release_time: f32,
    sample_rate: f32,
    attack_increment: f32,
    decay_increment: f32,
    release_increment: f32,
    release_start_value: f32, // Store value when release starts
}

impl Envelope {
    pub fn new(sample_rate: f32) -> Self {
        Envelope {
            stage: EnvelopeStage::Idle,
            value: 0.0,
            attack_time: 0.01,
            decay_time: 0.3,
            sustain_level: 0.7,
            release_time: 0.5,
            sample_rate,
            attack_increment: 0.0,
            decay_increment: 0.0,
            release_increment: 0.0,
            release_start_value: 0.0,
        }
    }

    pub fn set_adsr(&mut self, attack: f32, decay: f32, sustain: f32, release: f32) {
        self.attack_time = attack.max(0.001);
        self.decay_time = decay.max(0.001);
        self.sustain_level = sustain.clamp(0.0, 1.0);
        self.release_time = release.max(0.001);

        let attack_samples = (self.attack_time * self.sample_rate).max(1.0);
        let decay_samples = (self.decay_time * self.sample_rate).max(1.0);

        self.attack_increment = 1.0 / attack_samples;
        self.decay_increment = (1.0 - self.sustain_level) / decay_samples;
        // Release increment calculated dynamically in gate_off
    }

    pub fn gate_on(&mut self) {
        self.stage = EnvelopeStage::Attack;
    }

    pub fn gate_off(&mut self) {
        if self.stage != EnvelopeStage::Idle {
            // Store current value when starting release
            self.release_start_value = self.value;
            
            // Calculate release increment from current value to 0
            let release_samples = (self.release_time * self.sample_rate).max(1.0);
            self.release_increment = self.release_start_value / release_samples;
            
            self.stage = EnvelopeStage::Release;
        }
    }

    pub fn process(&mut self) -> f32 {
        match self.stage {
            EnvelopeStage::Idle => {
                self.value = 0.0;
            }
            EnvelopeStage::Attack => {
                self.value += self.attack_increment;
                if self.value >= 1.0 {
                    self.value = 1.0;
                    self.stage = EnvelopeStage::Decay;
                }
            }
            EnvelopeStage::Decay => {
                self.value -= self.decay_increment;
                if self.value <= self.sustain_level {
                    self.value = self.sustain_level;
                    self.stage = EnvelopeStage::Sustain;
                }
            }
            EnvelopeStage::Sustain => {
                self.value = self.sustain_level;
            }
            EnvelopeStage::Release => {
                self.value -= self.release_increment;
                if self.value <= 0.0 {
                    self.value = 0.0;
                    self.stage = EnvelopeStage::Idle;
                }
            }
        }
        self.value
    }

    pub fn is_active(&self) -> bool {
        self.stage != EnvelopeStage::Idle
    }
}

