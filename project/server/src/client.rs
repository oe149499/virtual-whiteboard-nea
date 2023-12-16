//! Interfacing with clients
//! The main interface of this module is [`create_board_filter`], which builds a filter to forward WebSocket requests to a board

use warp::{filters::{BoxedFilter, ws::{WebSocket, Ws}}, reply::Reply, Filter};

use crate::message::ClientID;

/// Create the board route as a [`Filter`]
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

async fn handle_client(_name: String, _ws: WebSocket) {
	let _id = ClientID::new();
}