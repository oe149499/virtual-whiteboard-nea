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