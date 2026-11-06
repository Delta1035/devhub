use std::net::TcpListener;

/// Common development server ports to detect when not explicitly flagged.
pub const COMMON_PORTS: &[u16] = &[3000, 8080, 5173, 8000, 8081, 3001, 4200, 5000, 9000, 8888];

/// Check if a given TCP port is currently occupied on localhost.
pub fn is_port_occupied(port: u16) -> bool {
    if port == 0 {
        return false;
    }
    TcpListener::bind(("127.0.0.1", port)).is_err()
}

/// Helper to parse a valid non-zero u16 port from a string slice, trimming quotes and semicolons.
fn parse_port(s: &str) -> Option<u16> {
    let clean = s
        .trim()
        .trim_matches(|c: char| c == '\'' || c == '"' || c == ';');
    clean.parse::<u16>().ok().filter(|&port| port > 0)
}

/// Helper to extract a port number from URL or host string (e.g. "localhost:3000", "http://127.0.0.1:8080/api").
fn extract_host_port(token: &str) -> Option<u16> {
    if let Some(colon_idx) = token.rfind(':') {
        let after_colon = &token[colon_idx + 1..];
        let num_str: String = after_colon
            .chars()
            .take_while(|c| c.is_ascii_digit())
            .collect();
        if !num_str.is_empty() {
            return parse_port(&num_str);
        }
    }
    None
}

/// Infer potential port numbers from a command line string.
/// Matches `--port <num>`, `-p <num>`, `PORT=<num>`, `server.port=<num>`, and common dev ports.
pub fn infer_ports(cmd: &str) -> Vec<u16> {
    let mut ports = Vec::new();
    let tokens: Vec<&str> = cmd.split_whitespace().collect();
    let mut i = 0;

    while i < tokens.len() {
        let token = tokens[i];
        let token_lower = token.to_ascii_lowercase();

        // 1. --port <num> or --port=<num>
        if token_lower == "--port" {
            if let Some(next) = tokens.get(i + 1) {
                if let Some(p) = parse_port(next) {
                    ports.push(p);
                    i += 2;
                    continue;
                }
            }
        } else if let Some(val) = token_lower.strip_prefix("--port=") {
            if let Some(p) = parse_port(val) {
                ports.push(p);
            }
        }

        // 2. -p <num> or -p=<num>
        if token == "-p" {
            if let Some(next) = tokens.get(i + 1) {
                if let Some(p) = parse_port(next) {
                    ports.push(p);
                    i += 2;
                    continue;
                }
            }
        } else if let Some(val) = token.strip_prefix("-p=") {
            if let Some(p) = parse_port(val) {
                ports.push(p);
            }
        }

        // 3. PORT=<num> or port=<num> (e.g. PORT=3000 or cross-env PORT=3000)
        let token_upper = token.to_ascii_uppercase();
        if let Some(idx) = token_upper.find("PORT=") {
            let val = &token[idx + 5..];
            if let Some(p) = parse_port(val) {
                ports.push(p);
            }
        }

        // 4. server.port=<num> or -Dserver.port=<num> (Spring Boot etc.)
        if let Some(idx) = token_lower.find("server.port=") {
            let val = &token[idx + "server.port=".len()..];
            if let Some(p) = parse_port(val) {
                ports.push(p);
            }
        }

        i += 1;
    }

    // 5. Check URL host:port or standalone common ports
    for &token in &tokens {
        if let Some(p) = extract_host_port(token) {
            if COMMON_PORTS.contains(&p) || ports.is_empty() {
                ports.push(p);
            }
        } else if let Some(p) = parse_port(token) {
            if COMMON_PORTS.contains(&p) {
                ports.push(p);
            }
        }
    }

    // Deduplicate while maintaining insertion order
    let mut deduped = Vec::new();
    for p in ports {
        if !deduped.contains(&p) {
            deduped.push(p);
        }
    }
    deduped
}

/// Infer the most likely primary port from a command string.
pub fn infer_port(cmd: &str) -> Option<u16> {
    infer_ports(cmd).into_iter().next()
}

/// Detect whether any inferred port in the command line is currently occupied.
/// Returns the first conflicting port if found, or None.
pub fn detect_port_conflict(cmd: &str) -> Option<u16> {
    infer_ports(cmd)
        .into_iter()
        .find(|&port| is_port_occupied(port))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_infer_port_explicit_flags() {
        assert_eq!(infer_port("npm run dev -- --port 8080"), Some(8080));
        assert_eq!(infer_port("vite --port=5173"), Some(5173));
        assert_eq!(infer_port("next dev -p 3000"), Some(3000));
        assert_eq!(infer_port("next dev -p=3001"), Some(3001));
    }

    #[test]
    fn test_infer_port_env_and_jvm_properties() {
        assert_eq!(infer_port("PORT=4000 node index.js"), Some(4000));
        assert_eq!(infer_port("cross-env PORT=\"5000\" nodemon"), Some(5000));
        assert_eq!(
            infer_port("java -jar app.jar --server.port=8080"),
            Some(8080)
        );
        assert_eq!(
            infer_port("mvn spring-boot:run -Dserver.port=9090"),
            Some(9090)
        );
    }

    #[test]
    fn test_infer_port_common_ports_and_urls() {
        assert_eq!(infer_port("python3 -m http.server 8080"), Some(8080));
        assert_eq!(infer_port("serve -s dist 3000"), Some(3000));
        assert_eq!(infer_port("curl http://localhost:8080/api"), Some(8080));
        assert_eq!(infer_port("http://127.0.0.1:5173"), Some(5173));
    }

    #[test]
    fn test_infer_port_none_for_unrelated_commands() {
        assert_eq!(infer_port("npm test"), None);
        assert_eq!(infer_port("cargo build --release"), None);
        assert_eq!(infer_port("echo -p hello"), None);
        assert_eq!(infer_port(""), None);
    }

    #[test]
    fn test_is_port_occupied_and_conflict_detection() {
        // Bind a random available port on localhost
        let listener = TcpListener::bind(("127.0.0.1", 0)).expect("failed to bind ephemeral port");
        let port = listener.local_addr().unwrap().port();

        // While listener is held, port must be occupied
        assert!(is_port_occupied(port));

        let occupied_cmd = format!("npm run dev -- --port {}", port);
        assert_eq!(detect_port_conflict(&occupied_cmd), Some(port));

        // Unbound / free port shouldn't conflict once listener is dropped
        drop(listener);
        assert!(!is_port_occupied(port));
        assert_eq!(detect_port_conflict(&occupied_cmd), None);
    }
}
