// TT munching
#![recursion_limit = "256"]

#[path ="message/message.rs"]
pub mod message;
#[path ="canvas/canvas.rs"]
pub mod canvas;
#[path ="tags/tags.rs"]
pub mod tags;
#[path ="board/board.rs"]
pub mod board;
pub mod client;

use std::path::PathBuf;

use warp::{filters::BoxedFilter, reply::{Reply, self}, Filter};

pub fn create_api_filter() -> BoxedFilter<(impl Reply,)> {
	warp::any()
		.map(|| reply::reply())
		.boxed()
}

pub fn create_static_filter(path: PathBuf) -> BoxedFilter<(impl Reply,)> {
	warp::fs::dir(path).boxed()
}

pub fn create_script_filter(path: PathBuf, enable_source: bool) -> BoxedFilter<(impl Reply,)> {
	let main_filter = warp::fs::dir(path.join("out"));
	if enable_source {
		warp::path("source").and(warp::fs::dir(path))
			.or(main_filter).unify().boxed()
	} else {
		main_filter.boxed()
	}
}