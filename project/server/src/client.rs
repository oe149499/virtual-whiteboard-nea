//! Interfacing with clients
//! The main interface of this module is [`create_board_filter`], which builds a filter to forward WebSocket requests to a board

use futures_util::{StreamExt, SinkExt};
use log::{warn, error, info};
use warp::{filters::{BoxedFilter, ws::{WebSocket, Ws, Message}}, reply::Reply, Filter};
use tokio::sync::mpsc;

use crate::{message::MsgSend, counter, board::{BoardManager, BoardHandle}};

/// A unique ID for each WebSocket connection
#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub struct ConnectionID(usize);

impl ConnectionID {
	/// Atomically create a new [`ConnectionID`]
	fn new() -> Self {
		Self(counter!(AtomicUsize))
	}
}

enum ClientMessage {
	ClientMessage(MsgSend),
}

/// A handle used to send messages mack to a client
#[derive(Debug)]
pub struct ClientHandle {
	message_pipe: mpsc::UnboundedSender<ClientMessage>,
}

impl ClientHandle {
	fn new() -> (Self, mpsc::UnboundedReceiver<ClientMessage>) {
		let (sender, receiver) = mpsc::unbounded_channel();
		(
			Self {
				message_pipe: sender,
			},
			receiver
		)
	}

	fn send(&self, message: ClientMessage) {
		self.message_pipe.send(message)
			.unwrap_or_else(|e| {
				warn!("Failed to dispatch message to client: {e}");
			})
	}

	/// Dispatch a message to a client
	pub fn send_message(&self, message: MsgSend) {
		self.send(ClientMessage::ClientMessage(message));
	}
}

/// Create the board route as a [`Filter`]
pub fn create_board_filter(board_manager: &'static BoardManager) -> BoxedFilter<(impl Reply,)> {
	warp::path!(String)
		.and(warp::ws())
		.and_then(|name: String, ws: Ws| async {
			if let Some(handle) = board_manager.load_board(name).await {
				Ok(ws.on_upgrade(|ws| async {
					handle_client(handle, ws).await
				}))
			} else {
				Err(warp::reject())
			}
		})
		.boxed()
}

async fn handle_client(board: BoardHandle, ws: WebSocket) {
	let id = ConnectionID::new();

	let (mut tx, mut rx) = ws.split();

	let (handle, mut board_recv) = ClientHandle::new();

	board.client_connected(id, handle);
	
	tokio::task::spawn(async move {
		while let Some(msg) = board_recv.recv().await {
			match msg {
				ClientMessage::ClientMessage(msg) => {
					let payload = serde_json::to_vec(&msg)
						.unwrap_or_else(|e| {
							error!("Failed to serialize message: {e}");
							panic!();
						});
					tx.send(Message::binary(payload)).await
						.unwrap_or_else(|e| {
							warn!("Failed to send WebSocket message: {e}")
						});
				}
			}
		}
	});

	while let Some(msg) = rx.next().await {
		match msg {
			Ok(msg) => {
				match serde_json::from_slice(msg.as_bytes()) {
					Ok(msg) => board.client_msg(id, msg),
					Err(e) => {
						info!("Received malformed message from client: {e}")
					},
				}
			}
			Err(e) => {
				warn!("Error receiving WebSocket message: {e}");
			}
		}
	}
}