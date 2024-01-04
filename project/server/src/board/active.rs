#[path = "./iterate_impls.rs"]
mod iterate_impls;
#[path = "./method_impls.rs"]
mod method_impls;

use std::{future::Future, sync::Arc};

use log::error;
use scc::{hash_map::OccupiedEntry, HashMap as AsyncHashMap};
use tokio::sync::RwLock;

use crate::{
    canvas::ActiveCanvas,
    client::{ClientHandle, MessagePayload},
    message::{
        notify_c::{ClientJoined, NotifyCType},
        ClientID, ClientInfo, ConnectionInfo, ItemID, MsgRecv, MsgSend, SessionID,
    },
};

use super::{BoardHandle, BoardMessage};

#[derive(Debug)]
struct ClientState {
    info: ClientInfo,
    handle: Option<ClientHandle>,
    session: SessionID,
    selection: std::collections::BTreeSet<ItemID>,
}

impl ClientState {
    /// Send a message to the client if it has a handle attached
    fn try_send(&self, msg: MsgSend) {
        if let Some(handle) = &self.handle {
            handle.send_message(msg);
        }
    }

    fn try_send_payload(&self, payload: &MessagePayload) {
        if let Some(handle) = &self.handle {
            handle.send_payload(payload);
        }
    }
}

struct Board {
    client_ids: RwLock<std::collections::BTreeSet<ClientID>>,
    clients: AsyncHashMap<ClientID, ClientState>,
    canvas: ActiveCanvas,
    selected_items: AsyncHashMap<ItemID, ClientID>,
}

impl Board {
    fn new_debug() -> Self {
        Self {
            client_ids: Default::default(),
            clients: AsyncHashMap::new(),
            canvas: ActiveCanvas::new_empty(),
            selected_items: AsyncHashMap::new(),
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
                    info: info.clone(),
                    handle: None,
                    session: session_id,
                    selection: Default::default(),
                };
                self.clients
                    .insert_async(client_id, client)
                    .await
                    .expect("Duplicate Client IDs, something is very wrong");
                self.client_ids.write().await.insert(client_id);

                let connection = ConnectionInfo {
                    client_id,
                    session_id,
                };
                reply.send(Ok(connection)).unwrap_or_else(|e| {
                    error!("Failed to send session creation reply: {e:?}");
                });

                self.send_notify_c(ClientJoined {
                    id: client_id,
                    info,
                })
                .await
            }
        }
    }

    async fn handle_client_message(&self, id: ClientID, msg: MsgRecv) {
        match msg {
            MsgRecv::Method(method) => self.handle_method(id, method).await,
            MsgRecv::Iterate(iterate) => todo!(),
        }
    }

    async fn get_client(&self, id: &ClientID) -> OccupiedEntry<'_, ClientID, ClientState> {
        self.clients
            .get_async(id)
            .await
            .expect("Missing client ID, something is very wrong")
    }

    async fn send_notify_c(&self, msg: impl NotifyCType) {
        let msg = msg.as_notify().as_msg();
        let payload = MessagePayload::new(&msg);
        for id in self.client_ids.read().await.iter() {
            self.get_client(id).await.get().try_send_payload(&payload)
        }
    }
}

/// Creates a handle for a board that can be used for testing
pub fn debug_board() -> BoardHandle {
    let board = Board::new_debug();
    let (handle, task) = board.launch(4);
    tokio::task::spawn(task);
    handle
}
