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
mod utils;

use std::path::PathBuf;

use board::BoardManager;
use client::{create_client_filter, SessionRegistry};
use warp::{filters::BoxedFilter, reply::Reply, Filter};

/// A container of all resources shared across parts of the application
pub struct GlobalResources {
    boards: BoardManager,
    sessions: SessionRegistry,
}

/// A reference-counted wrapper of [`GlobalResources`]
pub type GlobalRes = &'static GlobalResources;

impl GlobalResources {
    /// Initialise the structure with the given fields
    pub fn new(boards: BoardManager) -> Self {
        Self {
            boards,
            sessions: SessionRegistry::default(),
        }
    }

    /// Move [`self`] into a reference-counted pointer
    pub fn as_static(self) -> GlobalRes {
        Box::leak(Box::new(self))
    }
}

/// Create a warp [`Filter`] handling all dynamic paths
pub fn create_api_filter(res: GlobalRes) -> BoxedFilter<(impl Reply,)> {
    create_client_filter(res).boxed()
}

/// Create a warp [`Filter`] serving static files
pub fn create_static_filter(path: PathBuf) -> BoxedFilter<(impl Reply,)> {
    warp::fs::dir(path).boxed()
}

/// Create a warp [`Filter`] serving scripts, and optionally the original source files
pub fn create_script_filter(path: PathBuf, enable_source: bool) -> BoxedFilter<(impl Reply,)> {
    let main_filter = warp::fs::dir(path.join("out"));
    if enable_source {
        warp::path("source")
            .and(warp::fs::dir(path.join("src")))
            .or(main_filter)
            .unify()
            .boxed()
    } else {
        main_filter.boxed()
    }
}
