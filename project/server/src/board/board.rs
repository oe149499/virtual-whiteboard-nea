//! The implementation of the board itself
mod manager;

pub use manager::BoardManager;

use log::warn;
use tokio::sync::mpsc;
use crate::message::{MsgRecv, ClientID};

enum BoardMessage {
	ClientMessage(ClientID, MsgRecv),
}

/// A reference to an active board that can be used to interact with it
#[derive(Clone)]
pub struct BoardHandle {
	message_pipe: mpsc::UnboundedSender<BoardMessage>,
}

impl BoardHandle {
	/// Send a message to the board
	pub fn client_msg(&self, id: ClientID, msg: MsgRecv) {
		self.message_pipe.send(
			BoardMessage::ClientMessage(id, msg)
		).unwrap_or_else(|e| {
			warn!("Failed to send client message to board: {e}");
		})
	}
}