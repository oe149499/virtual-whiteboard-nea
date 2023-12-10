pub mod manager;

use tokio::sync::mpsc;
use crate::message::{MsgRecv, ClientID};

enum BoardMessage {
	ClientMessage(ClientID, MsgRecv),
}

#[derive(Clone)]
pub struct BoardHandle {
	message_pipe: mpsc::UnboundedSender<BoardMessage>,
}

impl BoardHandle {
	pub fn client_msg(&self, id: ClientID, msg: MsgRecv) {
		self.message_pipe.send(
			BoardMessage::ClientMessage(id, msg)
		).expect("")
	}
}