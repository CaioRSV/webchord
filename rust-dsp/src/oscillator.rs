#[derive(Clone, Copy)]
pub enum Waveform {
    Sine = 0,
    Sawtooth = 1,
    Square = 2,
    Triangle = 3,
    FM = 4,
    Piano = 5,
}

pub struct Oscillator {
    phase: f32,
    phase_increment: f32,
    frequency: f32,
    sample_rate: f32,
    waveform: Waveform,
    detune: f32,
}

impl Oscillator {
    pub fn new(sample_rate: f32) -> Self {
        Oscillator {
            phase: 0.0,
            phase_increment: 0.0,
            frequency: 440.0,
            sample_rate,
            waveform: Waveform::Sine,
            detune: 0.0,
        }
    }

    pub fn set_frequency(&mut self, freq: f32) {
        self.frequency = freq;
        let detuned_freq = freq * 2.0_f32.powf(self.detune / 1200.0);
        self.phase_increment = detuned_freq / self.sample_rate;
    }

    pub fn set_waveform(&mut self, waveform: u8) {
        self.waveform = match waveform {
            0 => Waveform::Sine,
            1 => Waveform::Sawtooth,
            2 => Waveform::Square,
            3 => Waveform::Triangle,
            4 => Waveform::FM,
            5 => Waveform::Piano,
            _ => Waveform::Sine,
        };
    }

    pub fn set_detune(&mut self, cents: f32) {
        self.detune = cents;
        let detuned_freq = self.frequency * 2.0_f32.powf(self.detune / 1200.0);
        self.phase_increment = detuned_freq / self.sample_rate;
    }

    pub fn process(&mut self) -> f32 {
        let output = match self.waveform {
            Waveform::Sine => self.sine(),
            Waveform::Sawtooth => self.sawtooth(),
            Waveform::Square => self.square(),
            Waveform::Triangle => self.triangle(),
            Waveform::FM => self.fm(),
            Waveform::Piano => self.piano(),
        };

        self.phase += self.phase_increment;
        if self.phase >= 1.0 {
            self.phase -= 1.0;
        }

        output
    }

    fn sine(&self) -> f32 {
        (self.phase * 2.0 * std::f32::consts::PI).sin()
    }

    fn sawtooth(&self) -> f32 {
        // PolyBLEP anti-aliased sawtooth
        let t = self.phase;
        let mut output = 2.0 * t - 1.0;
        output -= self.poly_blep(t);
        output
    }

    fn square(&self) -> f32 {
        // PolyBLEP anti-aliased square
        let t = self.phase;
        let mut output = if t < 0.5 { 1.0 } else { -1.0 };
        output += self.poly_blep(t);
        output -= self.poly_blep((t + 0.5) % 1.0);
        output
    }

    fn triangle(&self) -> f32 {
        // Integrated square wave
        let t = self.phase;
        let mut output = if t < 0.5 {
            4.0 * t - 1.0
        } else {
            3.0 - 4.0 * t
        };
        // Apply PolyBLEP smoothing
        let dt = self.phase_increment;
        if t < dt {
            output *= t / dt;
        } else if t > 1.0 - dt {
            output *= (1.0 - t) / dt;
        }
        output
    }

    fn fm(&self) -> f32 {
        // Wurlitzer-style FM synthesis
        let carrier = self.phase * 2.0 * std::f32::consts::PI;
        let modulator = carrier * 2.0;
        (carrier + 0.3 * modulator.sin()).sin()
    }

    fn piano(&self) -> f32 {
        // Additive synthesis with harmonic decay
        let fundamental = self.phase * 2.0 * std::f32::consts::PI;
        let mut output = fundamental.sin();
        output += 0.5 * (fundamental * 2.0).sin();
        output += 0.25 * (fundamental * 3.0).sin();
        output += 0.125 * (fundamental * 4.0).sin();
        output / 1.875 // Normalize
    }

    fn poly_blep(&self, t: f32) -> f32 {
        let dt = self.phase_increment;
        if t < dt {
            let t_div_dt = t / dt;
            return t_div_dt + t_div_dt - t_div_dt * t_div_dt - 1.0;
        } else if t > 1.0 - dt {
            let t = 1.0 - t;
            let t_div_dt = t / dt;
            return -(t_div_dt + t_div_dt - t_div_dt * t_div_dt - 1.0);
        }
        0.0
    }

    pub fn reset_phase(&mut self) {
        self.phase = 0.0;
    }
}

