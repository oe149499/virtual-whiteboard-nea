//! The virtual whiteboard

#![recursion_limit = "256"] // TT munching
#![warn(missing_docs)]

#[path = "board/board.rs"]
pub mod board;
#[path = "canvas/canvas.rs"]
pub mod canvas;
pub mod client;
#[path = "message/message.rs"]
pub mod message;
#[path = "tags/tags.rs"]
pub mod tags;
pub mod upload;
mod utils;

use std::{path::PathBuf, time::SystemTime};

use board::BoardManager;
use client::{create_client_filter, SessionRegistry};
use upload::create_upload_filter;
use warp::{filters::BoxedFilter, reply::Reply, Filter};

pub use upload::create_media_filter;

/// Global options for the application
#[derive(derive_builder::Builder)]
pub struct Configuration {
    /// Path to static files
    pub static_root: PathBuf,
    /// Path to script files
    pub script_root: PathBuf,
    /// Path to media files (upload and serving)
    pub media_root: PathBuf,
    /// Path to stored boards
    pub board_root: PathBuf,
    /// Whether or not to serve TypeScript files as well as generated JS
    pub serve_ts: bool,
}

/// A container of all resources shared across parts of the application
pub struct GlobalResources {
    /// See [`BoardManager`]
    pub boards: BoardManager,
    sessions: SessionRegistry,
    /// See [`Configuration`]
    pub config: Configuration,
}

/// A reference-counted wrapper of [`GlobalResources`]
pub type GlobalRes = &'static GlobalResources;

impl GlobalResources {
    /// Initialise the structure with the given fields
    pub fn new(boards: BoardManager, config: Configuration) -> Self {
        Self {
            boards,
            sessions: SessionRegistry::default(),
            config,
        }
    }

    /// Move [`self`] into a leaked static reference
    pub fn as_static(self) -> GlobalRes {
        Box::leak(Box::new(self))
    }
}

fn create_start_time_filter() -> BoxedFilter<(impl Reply,)> {
    let time = SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis()
        .to_string()
        .into_boxed_str();

    // Leak and reborrow immutably
    let time = &*Box::leak(time);

    warp::path("start_time").map(move || time).boxed()
}

/// Create a warp [`Filter`] handling all dynamic paths
pub fn create_api_filter(res: GlobalRes) -> BoxedFilter<(impl Reply,)> {
    create_start_time_filter()
        .or(create_client_filter(res))
        .or(create_upload_filter(res))
        .boxed()
}

/// Create a warp [`Filter`] serving static files
pub fn create_static_filter(res: GlobalRes) -> BoxedFilter<(impl Reply,)> {
    warp::fs::dir(res.config.static_root.to_owned()).boxed()
}

/// Create a warp [`Filter`] serving scripts, and optionally the original source files
pub fn create_script_filter(res: GlobalRes) -> BoxedFilter<(impl Reply,)> {
    let main_filter = warp::fs::dir(res.config.script_root.join("out"));
    if res.config.serve_ts {
        warp::path("source")
            .and(warp::fs::dir(res.config.script_root.join("src")))
            .or(main_filter)
            .unify()
            .boxed()
    } else {
        main_filter.boxed()
    }
}
