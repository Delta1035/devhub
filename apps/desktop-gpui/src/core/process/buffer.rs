pub struct OutputBuffer {
    lines: Vec<String>,
    max_lines: usize,
    max_bytes: usize,
    current_bytes: usize,
}

impl OutputBuffer {
    pub fn new(max_lines: usize, max_bytes: usize) -> Self {
        Self {
            lines: Vec::new(),
            max_lines,
            max_bytes,
            current_bytes: 0,
        }
    }

    pub fn default_buffer() -> Self {
        // 5000 lines or 512 KB
        Self::new(5000, 512 * 1024)
    }

    pub fn append_line(&mut self, line: String) {
        let line_len = line.len();
        self.current_bytes += line_len;
        self.lines.push(line);

        while self.lines.len() > self.max_lines || self.current_bytes > self.max_bytes {
            if let Some(removed) = self.lines.first() {
                self.current_bytes = self.current_bytes.saturating_sub(removed.len());
                self.lines.remove(0);
            } else {
                break;
            }
        }
    }

    pub fn clear(&mut self) {
        self.lines.clear();
        self.current_bytes = 0;
    }

    pub fn lines(&self) -> &[String] {
        &self.lines
    }

    pub fn len(&self) -> usize {
        self.lines.len()
    }

    pub fn is_empty(&self) -> bool {
        self.lines.is_empty()
    }
}
