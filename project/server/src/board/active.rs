use std::future::Future;

use log::debug;
use scc::HashMap;
use tokio::sync::mpsc;

use crate::{client::{ConnectionID, ClientHandle}, message::{ClientID, MsgRecv, method::{Methods, Call, Connect}}};

use super::{BoardHandle, BoardMessage};

struct ClientState {
	name: String,
	handle: Option<ClientHandle>,
	connection: Option<ConnectionID>,
}

#[derive(Debug)]
enum Connection {
	Pending(ClientHandle),
	Client(ClientID)
}

struct Board {
	connections: HashMap<ConnectionID, Connection>,
	clients: HashMap<ClientID, ClientState>,
}

impl Board {
	fn new_debug() -> Self {
		Self {
			clients: HashMap::new(),
			connections: HashMap::new(),
		}
	}
	fn launch(mut self) -> (BoardHandle, impl Future<Output = Self>) {
		let (sender, mut reciever) = mpsc::unbounded_channel();
		let result = async move {
			while let Some(msg) = reciever.recv().await {
				self.handle_message(msg).await;
			}
			self
		};
		(
			BoardHandle {message_pipe: sender},
			result
		)
	}

	async fn handle_message(&mut self, msg: BoardMessage) {
		match msg {
			BoardMessage::ClientMessage(id, msg) => {
				self.handle_client_message(id, msg).await;
			},
			BoardMessage::NewConnection(id, handle) => {
				self.connections
					.insert_async(id, Connection::Pending(handle))
					.await.expect("Duplicate connection IDs, something is badly wrong");
			},
			BoardMessage::ConnectionClosed(id) => {
				let connection = self.connections
					.get_async(&id)
					.await.expect("Missing Connection ID, something is badly wrong")
					.remove();
				if let Connection::Client(id) = connection {
					let mut _info = self.clients
						.get_async(&id)
						.await.expect("Missing Client ID, something is badly wrong");
					let info = _info.get_mut();
					info.connection.take();
					info.handle.take();
				}
			},
		}
	}

	async fn handle_client_message(&mut self, id: ConnectionID, msg: MsgRecv) {
		match msg {
			MsgRecv::Method(method) => {
				self.handle_method(id, method).await
			}
		}
	}
	
	async fn handle_method(&mut self, id: ConnectionID, method: Methods) {
		match method {
			Methods::Connect(c) => self.handle_connect(c).await,
			Methods::Reconnect(_) => todo!(),
			Methods::SelectionAddItems(_) => todo!(),
			Methods::SelectionRemoveItems(_) => todo!(),
			Methods::EditBatchItems(_) => todo!(),
			Methods::EditSingleItem(_) => todo!(),
			Methods::DeleteItems(_) => todo!(),
		}
	}

	async fn handle_connect(&mut self, c: Call<Connect>) {
		debug!("Connection request: {c:?}");
	}
}

/// Creates a handle for a board that can be used for testing
pub fn debug_board() -> BoardHandle {
	let board = Board::new_debug();
	let (handle, task) = board.launch();
	tokio::task::spawn(task);
	handle
}