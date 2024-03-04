#[path = "./active_helpers.rs"]
mod active_helpers;
#[path = "./iterate_impls.rs"]
mod iterate_impls;
#[path = "./method_impls.rs"]
mod method_impls;

use std::{sync::Arc, time::Duration};

use log::error;
use scc::HashMap as AsyncHashMap;
use tokio::{
    sync::{oneshot, RwLock},
    time::Instant,
};

use crate::{
    canvas::{ActiveCanvas, SplineNode, Stroke, Transform},
    client::ClientHandle,
    message::{
        self as m,
        iterate::{GetActivePath, IterateHandle},
        notify_c::ClientJoined,
        ClientID, ClientInfo, ConnectionInfo, ItemID, MsgRecv, PathID, SessionID,
    },
};

use super::{BoardHandle, BoardMessage};

static PATH_FLUSH_TIME: Duration = Duration::from_millis(750);

#[derive(Debug)]
struct ActivePath {
    client: ClientID,
    nodes: Vec<SplineNode>,
    listeners: Vec<IterateHandle<GetActivePath>>,
    stroke: Stroke,
    last_flush: Instant,
}

#[derive(Debug, Default)]
struct SelectionState {
    items: std::collections::BTreeMap<ItemID, Transform>,
    own_transform: Transform,
}

#[derive(Debug)]
struct ClientState {
    info: ClientInfo,
    handle: Option<ClientHandle>,
    active_paths: Vec<PathID>,
    selection: SelectionState,
}

struct Board {
    client_ids: RwLock<std::collections::BTreeSet<ClientID>>,
    clients: AsyncHashMap<ClientID, ClientState>,
    canvas: Arc<ActiveCanvas>,
    selected_items: AsyncHashMap<ItemID, Option<ClientID>>,
    active_paths: AsyncHashMap<PathID, ActivePath>,
}

impl Board {
    fn new_from_canvas(canvas: Arc<ActiveCanvas>) -> Self {
        let selected_items = AsyncHashMap::default();

        for id in canvas.get_item_ids_sync().unwrap() {
            selected_items.insert(id, None).unwrap();
        }

        Self {
            client_ids: Default::default(),
            clients: Default::default(),
            canvas,
            selected_items,
            active_paths: Default::default(),
        }
    }

    fn launch(self, tasks: usize) -> BoardHandle {
        let (sender, receiver) = async_channel::unbounded();
        let self_rc = Arc::new(self);
        for _ in 0..tasks {
            let receiver = receiver.clone();
            let self_rc = self_rc.clone();
            tokio::task::spawn(async move {
                while let Ok(msg) = receiver.recv().await {
                    self_rc.handle_message(msg).await;
                }
            });
        }

        BoardHandle {
            message_pipe: sender,
        }
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
                self.handle_session_request(info, reply).await
            }
        }
    }

    async fn handle_session_request(
        &self,
        info: ClientInfo,
        reply: oneshot::Sender<Result<ConnectionInfo, m::Error>>,
    ) {
        let client_id = ClientID::new();
        let session_id = SessionID::new();
        let client = ClientState {
            info: info.clone(),
            handle: None,
            active_paths: Default::default(),
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

    async fn handle_client_message(&self, id: ClientID, msg: MsgRecv) {
        match msg {
            MsgRecv::Method(method) => self.handle_method(id, method).await,
            MsgRecv::Iterate(iterate) => self.handle_iterate(id, iterate).await,
        }
    }
}

pub fn from_canvas(canvas: Arc<ActiveCanvas>, tasks: usize) -> BoardHandle {
    let board = Board::new_from_canvas(canvas);
    board.launch(tasks)
}
