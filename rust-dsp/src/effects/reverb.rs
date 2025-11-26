pub struct Reverb {
    comb_filters: Vec<CombFilter>,
    allpass_filters: Vec<AllpassFilter>,
    room_size: f32,
    damping: f32,
}

struct CombFilter {
    buffer: Vec<f32>,
    write_pos: usize,
    feedback: f32,
    filter_state: f32,
}

struct AllpassFilter {
    buffer: Vec<f32>,
    write_pos: usize,
}

impl Reverb {
    pub fn new(sample_rate: f32) -> Self {
        // Freeverb-style reverb with 8 comb and 4 allpass filters
        // Scale delays based on sample rate (base is 44.1kHz)
        let scale = sample_rate / 44100.0;
        let comb_delays = vec![1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
        let allpass_delays = vec![556, 441, 341, 225];

        let mut comb_filters = Vec::new();
        for delay in comb_delays {
            let scaled_delay = (delay as f32 * scale) as usize;
            comb_filters.push(CombFilter::new(scaled_delay));
        }

        let mut allpass_filters = Vec::new();
        for delay in allpass_delays {
            let scaled_delay = (delay as f32 * scale) as usize;
            allpass_filters.push(AllpassFilter::new(scaled_delay));
        }

        Reverb {
            comb_filters,
            allpass_filters,
            room_size: 0.5,
            damping: 0.5,
        }
    }

    pub fn set_room_size(&mut self, size: f32) {
        self.room_size = size.clamp(0.0, 1.0);
        // Further reduced feedback to prevent distortion (0.35 to 0.5 range)
        let feedback = self.room_size * 0.15 + 0.35;
        for comb in &mut self.comb_filters {
            comb.set_feedback(feedback);
        }
    }

    pub fn set_damping(&mut self, damping: f32) {
        self.damping = damping.clamp(0.0, 1.0);
    }

    pub fn process(&mut self, input: f32) -> f32 {
        let mut output = 0.0;

        // Process through comb filters and AVERAGE instead of sum
        for comb in &mut self.comb_filters {
            output += comb.process(input, self.damping);
        }
        output /= self.comb_filters.len() as f32; // Average the comb outputs
        output *= 0.4; // Additional gain reduction to prevent distortion

        // Process through allpass filters
        for allpass in &mut self.allpass_filters {
            output = allpass.process(output);
        }

        // Wet/dry mix: 6% wet, 94% dry - very conservative to prevent volume spikes
        let wet = output * 0.06; // Much more reduced wet signal
        let dry = input * 0.94;  // More preserved dry signal
        
        wet + dry
    }
}

impl CombFilter {
    fn new(delay_samples: usize) -> Self {
        CombFilter {
            buffer: vec![0.0; delay_samples],
            write_pos: 0,
            feedback: 0.0,
            filter_state: 0.0,
        }
    }

    fn set_feedback(&mut self, feedback: f32) {
        self.feedback = feedback;
    }

    fn process(&mut self, input: f32, damping: f32) -> f32 {
        let read_pos = if self.write_pos == 0 {
            self.buffer.len() - 1
        } else {
            self.write_pos - 1
        };

        let delayed = self.buffer[read_pos];
        self.filter_state = delayed * (1.0 - damping) + self.filter_state * damping;
        let output = input + self.filter_state * self.feedback;
        self.buffer[self.write_pos] = output;

        self.write_pos += 1;
        if self.write_pos >= self.buffer.len() {
            self.write_pos = 0;
        }

        delayed
    }
}

impl AllpassFilter {
    fn new(delay_samples: usize) -> Self {
        AllpassFilter {
            buffer: vec![0.0; delay_samples],
            write_pos: 0,
        }
    }

    fn process(&mut self, input: f32) -> f32 {
        let read_pos = if self.write_pos == 0 {
            self.buffer.len() - 1
        } else {
            self.write_pos - 1
        };

        let delayed = self.buffer[read_pos];
        // Further reduced allpass feedback to 0.15 for cleaner sound
        let output = delayed + input * 0.15;
        self.buffer[self.write_pos] = input + delayed * 0.15;

        self.write_pos += 1;
        if self.write_pos >= self.buffer.len() {
            self.write_pos = 0;
        }

        output
    }
}

