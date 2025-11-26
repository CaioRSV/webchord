#[derive(Clone, Copy)]
pub enum LfoWaveform {
    Sine = 0,
    Triangle = 1,
    Square = 2,
    SampleHold = 3,
}

pub struct Lfo {
    phase: f32,
    phase_increment: f32,
    rate: f32,
    depth: f32,
    sample_rate: f32,
    waveform: LfoWaveform,
    sample_hold_value: f32,
    sample_hold_counter: f32,
}

impl Lfo {
    pub fn new(sample_rate: f32) -> Self {
        Lfo {
            phase: 0.0,
            phase_increment: 0.0,
            rate: 1.0,
            depth: 0.0,
            sample_rate,
            waveform: LfoWaveform::Sine,
            sample_hold_value: 0.0,
            sample_hold_counter: 0.0,
        }
    }

    pub fn set_rate(&mut self, rate_hz: f32) {
        self.rate = rate_hz.clamp(0.01, 50.0);
        self.phase_increment = self.rate / self.sample_rate;
    }

    pub fn set_depth(&mut self, depth: f32) {
        self.depth = depth.clamp(0.0, 1.0);
    }

    pub fn set_waveform(&mut self, waveform: u8) {
        self.waveform = match waveform {
            0 => LfoWaveform::Sine,
            1 => LfoWaveform::Triangle,
            2 => LfoWaveform::Square,
            3 => LfoWaveform::SampleHold,
            _ => LfoWaveform::Sine,
        };
    }

    pub fn process(&mut self) -> f32 {
        let output = match self.waveform {
            LfoWaveform::Sine => {
                (self.phase * 2.0 * std::f32::consts::PI).sin()
            }
            LfoWaveform::Triangle => {
                if self.phase < 0.5 {
                    4.0 * self.phase - 1.0
                } else {
                    3.0 - 4.0 * self.phase
                }
            }
            LfoWaveform::Square => {
                if self.phase < 0.5 { 1.0 } else { -1.0 }
            }
            LfoWaveform::SampleHold => {
                if self.sample_hold_counter <= 0.0 {
                    self.sample_hold_value = (rand::random() * 2.0) - 1.0;
                    self.sample_hold_counter = self.sample_rate / self.rate;
                }
                self.sample_hold_counter -= 1.0;
                self.sample_hold_value
            }
        };

        self.phase += self.phase_increment;
        if self.phase >= 1.0 {
            self.phase -= 1.0;
        }

        output * self.depth
    }
}

// Simple PRNG for sample-and-hold
mod rand {
    static mut SEED: u32 = 12345;

    pub fn random() -> f32 {
        unsafe {
            SEED = SEED.wrapping_mul(1103515245).wrapping_add(12345);
            (SEED >> 16) as f32 / 65536.0
        }
    }
}

