//! Interfacing with clients
//! The main interface of this module is [`create_client_filter`], which builds a filter to forward WebSocket requests to a board

use std::time::SystemTime;

use futures_util::{SinkExt, StreamExt};
use log::{error, info, warn};
use tokio::{sync::mpsc, time::Instant};
use warp::{
    filters::{
        ws::{Message, WebSocket, Ws},
        BoxedFilter,
    },
    reply::Reply,
    Filter,
};

use crate::{
    board::BoardHandle,
    message::{ClientID, ClientInfo, MsgRecv, MsgSend, SessionID},
    GlobalRes,
};

/// An opaque payload that can be duplicated and sent to multiple clients
pub struct MessagePayload(Vec<u8>);

impl MessagePayload {
    /// Create a new stored payload from the send message
    pub fn new(msg: &MsgSend) -> Self {
        Self(serde_json::to_vec(msg).expect("Failed to serialize payload"))
    }
}

enum ClientMessage {
    Payload(Vec<u8>),
}

/// A handle used to send messages mack to a client
#[derive(Debug, Clone)]
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
            receiver,
        )
    }

    fn send(&self, message: ClientMessage) {
        self.message_pipe.send(message).unwrap_or_else(|e| {
            warn!("Failed to dispatch message to client: {e}");
        })
    }

    fn send_data(&self, data: Vec<u8>) {
        self.send(ClientMessage::Payload(data))
    }

    /// Dispatch a message to a client
    pub fn send_message(&self, message: MsgSend) {
        let payload = MessagePayload::new(&message);
        self.send_data(payload.0);
    }

    /// Send a copy of an existing [`MessagePayload`]
    pub fn send_payload(&self, payload: &MessagePayload) {
        self.send_data(payload.0.clone())
    }
}

/// Max request body length for session creation (1KiB but subject to change)
pub static MAX_SESSION_CREATE_LENGTH: u64 = 1024;

#[derive(Clone)]
#[doc(hidden)]
pub struct Session {
    client_id: ClientID,
    handle: BoardHandle,
}

impl Session {
    fn connect(&self, handle: ClientHandle) {
        self.handle.client_connected(self.client_id, handle)
    }

    fn disconnect(&self) {
        self.handle.client_disconnected(self.client_id)
    }

    fn message(&self, msg: MsgRecv) {
        self.handle.client_msg(self.client_id, msg)
    }
}

/// Lookup table of session IDs
pub type SessionRegistry = tokio::sync::RwLock<std::collections::HashMap<SessionID, Session>>;

/// Create the board route as a [`Filter`]
pub fn create_client_filter(res: GlobalRes) -> BoxedFilter<(impl Reply,)> {
    let time = SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis()
        .to_string()
        .leak::<'static>();
    let time = &*time;

    let start_time = warp::path("start_time").map(move || time);

    let session: _ = warp::path!("session" / SessionID).and(warp::ws()).and_then(
        move |id: SessionID, ws: Ws| async move {
            let sessions = res.sessions.read().await;
            if let Some(session) = sessions.get(&id) {
                let session = session.clone();
                Ok(ws.on_upgrade(|ws| async { handle_session(session, ws).await }))
            } else {
                Err(warp::reject())
            }
        },
    );
    let session_create: _ = warp::path!("board" / String)
        .and(warp::body::content_length_limit(MAX_SESSION_CREATE_LENGTH))
        .and(warp::body::json())
        .and_then(|name, info: ClientInfo| async {
            if let Some(handle) = res.boards.load_board(name).await {
                let session = handle.create_session(info).await;
                if let Ok(info) = &session {
                    if let Some(_) = res.sessions.write().await.insert(
                        info.session_id,
                        Session {
                            client_id: info.client_id,
                            handle,
                        },
                    ) {
                        error!("Duplicate session ID: {:?}", info.session_id);
                    }
                }
                use crate::message::Result;
                Ok(
                    serde_json::to_string(&Result::from(session)).unwrap_or_else(|e| {
                        error!("Failed to serialize response: {e}");
                        String::new()
                    }),
                )
            } else {
                Err(warp::reject())
            }
        });
    session.or(session_create).or(start_time).boxed()
}

async fn handle_session(session: Session, ws: WebSocket) {
    let (mut tx, mut rx) = ws.split();

    let (handle, mut board_recv) = ClientHandle::new();

    session.connect(handle);

    tokio::task::spawn(async move {
        while let Some(msg) = board_recv.recv().await {
            match msg {
                ClientMessage::Payload(msg) => {
                    tx.send(Message::binary(msg))
                        .await
                        .unwrap_or_else(|e| warn!("Failed to send WebSocket message: {e}"));
                }
            }
        }
    });

    while let Some(msg) = rx.next().await {
        match msg {
            Ok(msg) => {
                if msg.is_close() {
                    session.disconnect();
                    info!("Socket closed");
                } else {
                    match serde_json::from_slice(msg.as_bytes()) {
                        Ok(msg) => session.message(msg),
                        Err(e) => {
                            info!(
                                "Received malformed message from client: {e}\n{}",
                                msg.to_str().unwrap_or(""),
                            )
                        }
                    }
                }
            }
            Err(e) => {
                warn!("Error receiving WebSocket message: {e}");
            }
        }
    }
}
