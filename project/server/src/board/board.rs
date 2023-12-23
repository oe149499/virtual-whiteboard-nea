//! The implementation of the board itself
mod active;
mod manager;

pub use manager::BoardManager;

use crate::{
    client::ClientHandle,
    message::{self, ClientID, ClientInfo, ConnectionInfo, MsgRecv},
};
use log::{error, warn};
use tokio::sync::{mpsc, oneshot};

enum BoardMessage {
    ClientMessage(ClientID, MsgRecv),
    SessionRequest(
        ClientInfo,
        oneshot::Sender<Result<ConnectionInfo, message::Error>>,
    ),
    ClientConnected(ClientID, ClientHandle),
    ClientDisconnected(ClientID),
}

/// A reference to an active board that can be used to interact with it
#[derive(Clone)]
pub struct BoardHandle {
    message_pipe: async_channel::Sender<BoardMessage>,
}

impl BoardHandle {
    fn send_msg(&self, msg: BoardMessage) {
        self.message_pipe.try_send(msg).unwrap_or_else(|e| {
            warn!("Failed to send message to board: {e}");
        })
    }

    /// Register a new client
    pub async fn create_session(&self, info: ClientInfo) -> Result<ConnectionInfo, message::Error> {
        let (send, recv) = oneshot::channel();
        self.send_msg(BoardMessage::SessionRequest(info, send));
        recv.await.unwrap_or_else(|e| {
            error!("Failed to recieve session creation response from board: {e}");
            Err(message::Error::internal())
        })
    }

    /// Send a message to the board
    pub fn client_msg(&self, id: ClientID, msg: MsgRecv) {
        self.send_msg(BoardMessage::ClientMessage(id, msg));
    }

    /// Inform the board that a new client has connected
    pub fn client_connected(&self, id: ClientID, handle: ClientHandle) {
        self.send_msg(BoardMessage::ClientConnected(id, handle));
    }

    /// Inform the board that a client has disconnected
    pub fn client_disconnected(&self, id: ClientID) {
        self.send_msg(BoardMessage::ClientDisconnected(id));
    }
}
