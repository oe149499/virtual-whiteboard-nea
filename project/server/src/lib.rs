//! The virtual whiteboard

#![recursion_limit = "256"] // TT munching
#![warn(missing_docs)]

#[path ="message/message.rs"]
pub mod message;
#[path ="canvas/canvas.rs"]
pub mod canvas;
#[path ="tags/tags.rs"]
pub mod tags;
#[path ="board/board.rs"]
pub mod board;
pub mod client;
mod utils;

use std::path::PathBuf;

use board::BoardManager;
use client::create_board_filter;
use warp::{filters::{BoxedFilter, path::path}, reply::Reply, Filter};

/// Create a warp [`Filter`] handling all dynamic paths
pub fn create_api_filter(manager: &'static BoardManager) -> BoxedFilter<(impl Reply,)> {
	warp::any()
		.and(path("board").and(create_board_filter(manager)))
		.boxed()
}

/// Create a warp [`Filter`] serving static files
pub fn create_static_filter(path: PathBuf) -> BoxedFilter<(impl Reply,)> {
	warp::fs::dir(path).boxed()
}

/// Create a warp [`Filter`] serving scripts, and optionally the original source files
pub fn create_script_filter(path: PathBuf, enable_source: bool) -> BoxedFilter<(impl Reply,)> {
	let main_filter = warp::fs::dir(path.join("out"));
	if enable_source {
		warp::path("source").and(warp::fs::dir(path))
			.or(main_filter).unify().boxed()
	} else {
		main_filter.boxed()
	}
}