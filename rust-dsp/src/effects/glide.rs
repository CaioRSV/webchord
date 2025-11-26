pub struct Glide {
    current_freq: f32,
    target_freq: f32,
    glide_time: f32,
    sample_rate: f32,
    increment: f32,
}

impl Glide {
    pub fn new(sample_rate: f32) -> Self {
        Glide {
            current_freq: 440.0,
            target_freq: 440.0,
            glide_time: 0.0,
            sample_rate,
            increment: 0.0,
        }
    }

    pub fn set_glide_time(&mut self, time_ms: f32) {
        self.glide_time = time_ms;
    }

    pub fn set_target(&mut self, target_freq: f32) {
        self.target_freq = target_freq;
        if self.glide_time > 0.0 {
            let samples = (self.glide_time * self.sample_rate / 1000.0) as f32;
            self.increment = (target_freq - self.current_freq) / samples;
        } else {
            self.current_freq = target_freq;
            self.increment = 0.0;
        }
    }

    pub fn process(&mut self) -> f32 {
        if (self.current_freq - self.target_freq).abs() < 0.1 {
            self.current_freq = self.target_freq;
            self.increment = 0.0;
        } else {
            self.current_freq += self.increment;
        }
        self.current_freq
    }

    pub fn get_frequency(&self) -> f32 {
        self.current_freq
    }
}

