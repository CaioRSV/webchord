pub struct Delay {
    buffer: Vec<f32>,
    write_pos: usize,
    delay_samples: usize,
    feedback: f32,
    mix: f32,
    sample_rate: f32,
}

impl Delay {
    pub fn new(sample_rate: f32, max_delay_ms: f32) -> Self {
        let max_samples = (max_delay_ms * sample_rate / 1000.0) as usize;
        Delay {
            buffer: vec![0.0; max_samples],
            write_pos: 0,
            delay_samples: (sample_rate * 0.5 / 1000.0) as usize, // 0.5ms default
            feedback: 0.3,
            mix: 0.3,
            sample_rate,
        }
    }

    pub fn set_delay_time(&mut self, time_ms: f32) {
        self.delay_samples = ((time_ms * self.sample_rate) / 1000.0) as usize;
        self.delay_samples = self.delay_samples.min(self.buffer.len());
    }

    pub fn set_feedback(&mut self, feedback: f32) {
        self.feedback = feedback.clamp(0.0, 0.95);
    }

    pub fn set_mix(&mut self, mix: f32) {
        self.mix = mix.clamp(0.0, 1.0);
    }

    pub fn process(&mut self, input: f32) -> f32 {
        let read_pos = if self.write_pos >= self.delay_samples {
            self.write_pos - self.delay_samples
        } else {
            self.buffer.len() - (self.delay_samples - self.write_pos)
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

