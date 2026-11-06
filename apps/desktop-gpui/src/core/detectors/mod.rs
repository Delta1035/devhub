pub mod custom;
pub mod gradle;
pub mod maven;
pub mod npm;

use crate::domain::Script;
use std::path::Path;

pub use custom::detect_custom_scripts;
pub use gradle::detect_gradle_scripts;
pub use maven::detect_maven_scripts;
pub use npm::detect_npm_scripts;

pub fn detect_all_scripts(dir: &Path) -> Vec<Script> {
    let mut scripts = Vec::new();
    scripts.extend(detect_npm_scripts(dir));
    scripts.extend(detect_maven_scripts(dir));
    scripts.extend(detect_gradle_scripts(dir));
    scripts.extend(detect_custom_scripts(dir));
    scripts
}
