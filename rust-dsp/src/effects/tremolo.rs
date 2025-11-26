use crate::lfo::Lfo;

pub struct Tremolo {
    lfo: Lfo,
    depth: f32,
    rate: f32,
}

impl Tremolo {
    pub fn new(sample_rate: f32) -> Self {
        let mut lfo = Lfo::new(sample_rate);
        lfo.set_rate(5.0);
        Tremolo {
            lfo,
            depth: 0.5,
            rate: 5.0,
        }
    }

    pub fn set_rate(&mut self, rate_hz: f32) {
        self.rate = rate_hz;
        self.lfo.set_rate(rate_hz);
    }

    pub fn set_depth(&mut self, depth: f32) {
        self.depth = depth.clamp(0.0, 1.0);
        self.lfo.set_depth(depth);
    }

    pub fn process(&mut self, input: f32) -> f32 {
        let lfo_value = self.lfo.process();
        let modulation = 1.0 - (lfo_value * 0.5 + 0.5) * self.depth;
        input * modulation
    }
}

