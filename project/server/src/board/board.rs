//! The implementation of the board itself
mod manager;
mod active;

pub use manager::BoardManager;

use log::warn;
use tokio::sync::mpsc;
use crate::{message::MsgRecv, client::{ConnectionID, ClientHandle}};



enum BoardMessage {
	ClientMessage(ConnectionID, MsgRecv),
	NewConnection(ConnectionID, ClientHandle),
	ConnectionClosed(ConnectionID),
}

/// A reference to an active board that can be used to interact with it
#[derive(Clone)]
pub struct BoardHandle {
	message_pipe: mpsc::UnboundedSender<BoardMessage>,
}

impl BoardHandle {
	fn send_msg(&self, msg: BoardMessage) {
		self.message_pipe.send(msg)
			.unwrap_or_else(|e| {
				warn!("Failed to send message to board: {e}");
			})
	}
	/// Send a message to the board
	pub fn client_msg(&self, id: ConnectionID, msg: MsgRecv) {
		self.send_msg(BoardMessage::ClientMessage(id, msg));
	}

	/// Inform the board that a new client has connected
	pub fn client_connected(&self, id: ConnectionID, handle: ClientHandle) {
		self.send_msg(BoardMessage::NewConnection(id, handle));
	}

	/// Inform the board that a client has disconnected
	pub fn client_disconnected(&self, id: ConnectionID) {
		self.send_msg(BoardMessage::ConnectionClosed(id));
	}
}