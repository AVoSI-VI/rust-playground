#![deny(rust_2018_idioms)]

use rust_playground_top_crates::*;
use serde::Serialize;
use std::{
    collections::BTreeMap,
    fs::{self, File},
    path::{Path, PathBuf},
};

/// A Cargo.toml file.
#[derive(Serialize)]
#[serde(rename_all = "kebab-case")]
struct TomlManifest {
    package: TomlPackage,
    profile: Profiles,
    dependencies: BTreeMap<String, DependencySpec>,
    build_dependencies: BTreeMap<String, DependencySpec>,
}

/// Header of Cargo.toml file.
#[derive(Serialize)]
struct TomlPackage {
    name: String,
    version: String,
    authors: Vec<String>,
    resolver: String,
}

/// Profile used for build dependencies (build scripts, proc macros, and their
/// dependencies).
#[derive(Serialize)]
#[serde(rename_all = "kebab-case")]
struct BuildOverride {
    codegen_units: u32,
    debug: bool,
}

/// A profile section in a Cargo.toml file
#[derive(Serialize)]
#[serde(rename_all = "kebab-case")]
struct Profile {
    codegen_units: u32,
    incremental: bool,
    build_override: BuildOverride,
}

/// Available profile types
#[derive(Serialize)]
struct Profiles {
    dev: Profile,
    release: Profile,
}

fn main() {
    let d = fs::read_to_string("crate-modifications.toml")
        .expect("unable to read crate modifications file");

    let modifications: Modifications =
        toml::from_str(&d).expect("unable to parse crate modifications file");

    let (dependencies, infos) = rust_playground_top_crates::generate_info(&modifications);

    // Construct playground's Cargo.toml.
    let manifest = TomlManifest {
        package: TomlPackage {
            name: "playground".to_owned(),
            version: "0.0.1".to_owned(),
            authors: vec!["The Rust Playground".to_owned()],
            resolver: "2".to_owned(),
        },
        profile: Profiles {
            dev: Profile {
                codegen_units: 1,
                incremental: false,
                build_override: BuildOverride {
                    codegen_units: 1,
                    debug: true,
                },
            },
            release: Profile {
                codegen_units: 1,
                incremental: false,
                build_override: BuildOverride {
                    codegen_units: 1,
                    debug: false,
                },
            },
        },
        dependencies: dependencies.clone(),
        build_dependencies: dependencies,
    };

    // Write manifest file.
    let base_directory: PathBuf = std::env::args_os()
        .nth(1)
        .unwrap_or_else(|| "../compiler/base".into())
        .into();

    let cargo_toml = base_directory.join("Cargo.toml");
    write_manifest(manifest, &cargo_toml);
    println!("wrote {}", cargo_toml.display());

    let path = base_directory.join("crate-information.json");
    let mut f = File::create(&path)
        .unwrap_or_else(|e| panic!("Unable to create {}: {}", path.display(), e));
    serde_json::to_writer_pretty(&mut f, &infos)
        .unwrap_or_else(|e| panic!("Unable to write {}: {}", path.display(), e));
    println!("Wrote {}", path.display());
}

fn write_manifest(manifest: TomlManifest, path: impl AsRef<Path>) {
    let content = toml::to_string(&manifest).expect("Couldn't serialize TOML");

    let disclaimer = "# This file is automatically @generated by the top-crates script.
# Do not edit it manually. Any pull requests changing this file will likely be closed.
# See https://github.com/rust-lang/rust-playground/blob/main/CRATE_POLICY.md for details.
#
";

    let content = disclaimer.to_string() + &content;

    fs::write(path, content).expect("Couldn't write Cargo.toml");
}
