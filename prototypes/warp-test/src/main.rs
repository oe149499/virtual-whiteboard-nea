use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc
};
use std::collections::HashMap;

use tokio::sync::{mpsc, RwLock};
use tokio_stream::wrappers::UnboundedReceiverStream;

use warp::Filter;
use warp::ws::{Message, WebSocket};
use futures_util::{StreamExt, SinkExt};

static NEXT_ID: AtomicUsize = AtomicUsize::new(0);

type Clients = Arc<RwLock<HashMap<usize, mpsc::UnboundedSender<Message>>>>;

#[tokio::main]
async fn main() {

    let clients = Clients::default();
    let clients = warp::any().map(move || clients.clone());

    let static_serve = warp::path("static")
        .and(warp::fs::dir("static/"));

    let ws = warp::path("ws")
        .and(warp::ws())
        .and(clients)
        .map(|ws: warp::ws::Ws, clients| {
            ws.on_upgrade(move |socket| client_connected(socket, clients))
        });

    warp::serve(static_serve.or(ws))
        .run(([0,0,0,0], 8000))
        .await;
}

async fn client_connected(ws: WebSocket, clients: Clients) {
    let id = NEXT_ID.fetch_add(1, Ordering::Relaxed);

    let (mut client_tx, mut client_rx) = ws.split();
    
    let (tx, rx) = mpsc::unbounded_channel::<Message>();
    let mut rx = UnboundedReceiverStream::new(rx);
    tokio::task::spawn(async move {
        while let Some(message) = rx.next().await {
            let _ = client_tx.send(message).await;
        }
    });

    clients.write().await.insert(id, tx);
    
    while let Some(result) = client_rx.next().await {
        let msg = match result {
            Ok(msg) => msg,
            Err(e) => {
                eprintln!("ws error ({}): {}", id, e);
                break;
            }
        };
        
        process_message(id, msg, &clients).await;
    }

    clients.write().await.remove(&id);
}

async fn process_message(id: usize, msg: Message, clients: &Clients) {
    let msg = if let Ok(s) = msg.to_str() {s} else {return;};
    
    //let msg_format = format!("[{id}]: {msg}");

    for (&cid, tx) in clients.read().await.iter() {
        if id == cid {continue;}
        if let Err(_disconnected) = tx.send(Message::text(msg.clone())) {
        }
    }
}




