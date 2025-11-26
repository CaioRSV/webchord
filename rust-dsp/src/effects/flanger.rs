use crate::lfo::Lfo;

pub struct Flanger {
    buffer: Vec<f32>,
    write_pos: usize,
    lfo: Lfo,
    delay_range: f32,
    feedback: f32,
    mix: f32,
    sample_rate: f32,
}

impl Flanger {
    pub fn new(sample_rate: f32) -> Self {
        let max_delay_ms = 10.0;
        let max_samples = (max_delay_ms * sample_rate / 1000.0) as usize;
        
        Flanger {
            buffer: vec![0.0; max_samples],
            write_pos: 0,
            lfo: Lfo::new(sample_rate),
            delay_range: 5.0, // 0.5ms to 5ms
            feedback: 0.3,
            mix: 0.5,
            sample_rate,
        }
    }

    pub fn set_delay_range(&mut self, range_ms: f32) {
        self.delay_range = range_ms.clamp(0.5, 10.0);
    }

    pub fn set_feedback(&mut self, feedback: f32) {
        self.feedback = feedback.clamp(-0.99, 0.99);
    }

    pub fn set_mix(&mut self, mix: f32) {
        self.mix = mix.clamp(0.0, 1.0);
    }

    pub fn set_lfo_rate(&mut self, rate: f32) {
        self.lfo.set_rate(rate);
    }

    pub fn process(&mut self, input: f32) -> f32 {
        let lfo_value = self.lfo.process();
        let delay_ms = 0.5 + (self.delay_range - 0.5) * (lfo_value * 0.5 + 0.5);
        let delay_samples = ((delay_ms * self.sample_rate) / 1000.0) as usize;
        let delay_samples = delay_samples.min(self.buffer.len() - 1);

        let read_pos = if self.write_pos >= delay_samples {
            self.write_pos - delay_samples
        } else {
            self.buffer.len() - (delay_samples - self.write_pos)
        };

        let delayed = self.buffer[read_pos];
        let output = input + delayed * self.mix;
        self.buffer[self.write_pos] = input + delayed * self.feedback;

        self.write_pos += 1;
        if self.write_pos >= self.buffer.len() {
            self.write_pos = 0;
        }

        output
    }
}

