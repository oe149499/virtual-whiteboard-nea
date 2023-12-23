use std::{future::Future, sync::Arc};

use log::error;
use scc::{hash_map::OccupiedEntry, HashMap};
use tokio::task::yield_now;

use crate::{
    client::ClientHandle,
    message::{
        method::{Call, GetAllClientInfo, Methods},
        ClientID, ClientInfo, ClientTable, ConnectionInfo, MsgRecv, SessionID,
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
    fn launch(self, tasks: usize) -> (BoardHandle, impl Future<Output = Self>) {
        let (sender, receiver) = async_channel::unbounded();
        let self_rc = Arc::new(self);
        let mut handles = Vec::new();
        for _ in 0..tasks {
            let receiver = receiver.clone();
            let self_rc = self_rc.clone();
            let handle = tokio::task::spawn(async move {
                while let Ok(msg) = receiver.recv().await {
                    self_rc.handle_message(msg).await;
                }
            });
            handles.push(handle)
        }
        let result = async move {
            futures::future::join_all(handles).await;
            Arc::<Board>::into_inner(self_rc)
                .expect("Board references were not dropped by individual tasks")
        };
        (
            BoardHandle {
                message_pipe: sender,
            },
            result,
        )
    }

    async fn handle_message(&self, msg: BoardMessage) {
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

    async fn handle_client_message(&self, id: ClientID, msg: MsgRecv) {
        match msg {
            MsgRecv::Method(method) => self.handle_method(id, method).await,
        }
    }

    async fn handle_method(&self, id: ClientID, method: Methods) {
        match method {
            Methods::SelectionAddItems(_) => todo!(),
            Methods::SelectionRemoveItems(_) => todo!(),
            Methods::EditBatchItems(_) => todo!(),
            Methods::EditSingleItem(_) => todo!(),
            Methods::DeleteItems(_) => todo!(),
            Methods::GetAllClientInfo(call) => self.handle_get_all_client_info(id, call).await,
        }
    }

    async fn handle_get_all_client_info(&self, id: ClientID, call: Call<GetAllClientInfo>) {
        let mut out = std::collections::HashMap::new();
        self.clients
            .scan_async(|&k, v| {
                out.insert(k, v.info.clone());
            })
            .await;
        yield_now().await;
        let client = self.get_client(&id).await;
        if let Some(handle) = &client.get().handle {
            handle.send_message(call.create_ok(ClientTable(out)).to_msg());
        }
    }

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
    let (handle, task) = board.launch(4);
    tokio::task::spawn(task);
    handle
}
