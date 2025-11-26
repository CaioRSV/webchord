pub struct StateVariableFilter {
    sample_rate: f32,
    cutoff: f32,
    resonance: f32,
    low: f32,
    band: f32,
    high: f32,
    notch: f32,
}

impl StateVariableFilter {
    pub fn new(sample_rate: f32) -> Self {
        StateVariableFilter {
            sample_rate,
            cutoff: 20000.0,
            resonance: 0.707,
            low: 0.0,
            band: 0.0,
            high: 0.0,
            notch: 0.0,
        }
    }

    pub fn set_cutoff(&mut self, cutoff: f32) {
        self.cutoff = cutoff.clamp(20.0, 20000.0);
    }

    pub fn set_resonance(&mut self, resonance: f32) {
        self.resonance = resonance.clamp(0.5, 20.0);
    }

    pub fn process(&mut self, input: f32) -> f32 {
        let f = 2.0 * (self.cutoff / self.sample_rate);
        let f = f.clamp(0.0, 0.5);
        let q = 1.0 / self.resonance;

        // State variable filter algorithm
        self.low += f * self.band;
        self.high = input - self.low - q * self.band;
        self.band += f * self.high;
        self.notch = self.high + self.low;

        // Return lowpass output (can be changed to high, band, or notch)
        self.low
    }

    pub fn process_highpass(&mut self, input: f32) -> f32 {
        let f = 2.0 * (self.cutoff / self.sample_rate);
        let f = f.clamp(0.0, 0.5);
        let q = 1.0 / self.resonance;

        self.low += f * self.band;
        self.high = input - self.low - q * self.band;
        self.band += f * self.high;

        self.high
    }

    pub fn process_bandpass(&mut self, input: f32) -> f32 {
        let f = 2.0 * (self.cutoff / self.sample_rate);
        let f = f.clamp(0.0, 0.5);
        let q = 1.0 / self.resonance;

        self.low += f * self.band;
        self.high = input - self.low - q * self.band;
        self.band += f * self.high;

        self.band
    }
}

