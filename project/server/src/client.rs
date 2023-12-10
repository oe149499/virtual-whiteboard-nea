use std::sync::atomic::AtomicUsize;

use warp::{filters::{BoxedFilter, ws::{WebSocket, Ws}}, reply::Reply, Filter};

pub fn create_board_filter() -> BoxedFilter<(impl Reply,)> {
	warp::path!(String)
		.and(warp::ws())
		.map(|name: String, ws: Ws| {
			ws.on_upgrade(|ws| {
				handle_client(name, ws)
			})
		})
		.boxed()
}

async fn handle_client(name: String, ws: WebSocket) {
	static ID_COUNTER: AtomicUsize = AtomicUsize::new(0);

	let id = ID_COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
}