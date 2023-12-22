use std::future::Future;

use log::{error, info};
use scc::{hash_map::OccupiedEntry, HashMap};
use tokio::sync::mpsc;

use crate::{
    client::ClientHandle,
    message::{
        method::{Call, Methods},
        ClientID, ClientInfo, ConnectionInfo, MsgRecv, Result as MResult, SessionID,
    },
};

use super::{BoardHandle, BoardMessage};

#[derive(Debug)]
struct ClientState {
    info: ClientInfo,
    handle: Option<ClientHandle>,
    session: SessionID,
}

struct Board {
    clients: HashMap<ClientID, ClientState>,
}

impl Board {
    fn new_debug() -> Self {
        Self {
            clients: HashMap::new(),
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
            BoardHandle {
                message_pipe: sender,
            },
            result,
        )
    }

    async fn handle_message(&mut self, msg: BoardMessage) {
        match msg {
            BoardMessage::ClientMessage(id, msg) => {
                self.handle_client_message(id, msg).await;
            }
            BoardMessage::ClientConnected(id, handle) => {
                let mut client = self.get_client(&id).await;
                client.get_mut().handle = Some(handle);
            }
            BoardMessage::ClientDisconnected(id) => {
                let mut _info = self.get_client(&id).await;
                let info = _info.get_mut();
                info.handle.take();
            }
            BoardMessage::SessionRequest(info, reply) => {
                let client_id = ClientID::new();
                let session_id = SessionID::new();
                let client = ClientState {
                    info,
                    handle: None,
                    session: session_id,
                };
                self.clients
                    .insert_async(client_id, client)
                    .await
                    .expect("Duplicate Client IDs, something is very wrong");
                let connection = ConnectionInfo {
                    client_id,
                    session_id,
                };
                reply.send(Ok(connection)).unwrap_or_else(|e| {
                    error!("Failed to send session creation reply: {e:?}");
                })
            }
        }
    }

    async fn handle_client_message(&mut self, id: ClientID, msg: MsgRecv) {
        match msg {
            MsgRecv::Method(method) => self.handle_method(id, method).await,
        }
    }

    async fn handle_method(&mut self, id: ClientID, method: Methods) {
        match method {
            Methods::SelectionAddItems(_) => todo!(),
            Methods::SelectionRemoveItems(_) => todo!(),
            Methods::EditBatchItems(_) => todo!(),
            Methods::EditSingleItem(_) => todo!(),
            Methods::DeleteItems(_) => todo!(),
        }
    }

    /*async fn handle_connect(&mut self, id: Clien, c: Call<Connect>) {
        info!("Connection request: {c:?}");
        let mut connection = self.get_connection(&id).await;
        let conn = connection.get_mut();
        match conn {
            Connection::Pending(handle) => {
                let session_id = SessionID::new();
                let client_id = ClientID::new();

                handle.send_message(c.create_ok(
                    ConnectionInfo {
                        client_id,
                        session_id,
                    }
                ).to_msg());

                let client = ClientState {
                    info: c.params.info,
                    handle: Some(handle.clone()),
                    connection: Some(id),
                    session: session_id,
                };
                *conn = Connection::Client(client_id);
                self.clients.insert_async(client_id, client)
                    .await.expect("Duplicate client ID, something went wrong");

            },
            Connection::Client(_) => todo!(),
        }
    }*/

    async fn get_client(&self, id: &ClientID) -> OccupiedEntry<'_, ClientID, ClientState> {
        self.clients
            .get_async(id)
            .await
            .expect("Missing client ID, something is very wrong")
    }
}

/// Creates a handle for a board that can be used for testing
pub fn debug_board() -> BoardHandle {
    let board = Board::new_debug();
    let (handle, task) = board.launch();
    tokio::task::spawn(task);
    handle
}
