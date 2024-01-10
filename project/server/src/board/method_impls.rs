use std::collections;

use log::{debug, trace};
use tokio::time::Instant;

use crate::{
    canvas::{item::PathItem, Spline, Transform},
    message::{
        self,
        method::*,
        notify_c::{ItemCreated, PathStarted, SelectionItemsAdded},
        ClientID, ClientTable, ErrorCode,
    },
};

use super::{ActivePath, Board};

impl Board {
    pub async fn handle_method(&self, id: ClientID, method: Methods) {
        match method {
            Methods::SelectionAddItems(call) => self.handle_selection_add_items(id, call).await,
            Methods::SelectionRemoveItems(call) => todo!(),
            Methods::EditBatchItems(call) => todo!(),
            Methods::EditSingleItem(call) => todo!(),
            Methods::DeleteItems(call) => todo!(),
            Methods::CreateItem(call) => self.handle_create_item(id, call).await,
            Methods::BeginPath(call) => self.handle_begin_path(id, call).await,
            Methods::ContinuePath(call) => self.handle_continue_path(id, call).await,
            Methods::EndPath(call) => self.handle_end_path(id, call).await,
            Methods::GetAllItemIDs(call) => todo!(),
            Methods::GetAllClientInfo(call) => self.handle_get_all_client_info(id, call).await,
        }
    }

    async fn handle_selection_add_items(&self, id: ClientID, call: Call<SelectionAddItems>) {
        let mut result = Vec::with_capacity(call.params.items.len());
        let mut successful_ids = collections::BTreeSet::new();
        for &item_id in &call.params.items {
            let item = self.selected_items.entry_async(item_id).await;
            match item {
                scc::hash_map::Entry::Occupied(_) => {
                    result.push(message::Err(ErrorCode::NotAvailable.into()));
                }
                scc::hash_map::Entry::Vacant(entry) => {
                    entry.insert_entry(id);
                    result.push(message::Ok(()));
                    successful_ids.insert(item_id);
                }
            }
        }
        let mut client_entry = self.get_client(&id).await;
        let client = client_entry.get_mut();
        client.try_send(call.create_response(result).to_msg());
        self.send_notify_c(SelectionItemsAdded {
            id,
            items: successful_ids.iter().map(|i| *i).collect(),
        })
        .await;
        client.selection.append(&mut successful_ids);
    }

    async fn handle_create_item(&self, id: ClientID, call: Call<CreateItem>) {
        let item_id = self.canvas.add_item(call.params.item.clone()).await;
        self.get_client(&id)
            .await
            .get()
            .try_send(call.create_response(item_id).to_msg());
        self.send_notify_c(ItemCreated {
            id: item_id,
            item: call.params.item,
        })
        .await;
    }

    async fn handle_begin_path(&self, id: ClientID, call: Call<BeginPath>) {
        let mut client = self.get_client(&id).await;
        let path = ActivePath {
            nodes: Vec::new(),
            listeners: Default::default(),
            stroke: call.params.stroke.clone(),
            last_flush: Instant::now(),
        };

        let notify = PathStarted {
            id,
            stroke: call.params.stroke.clone(),
        };

        client.get_mut().path_state = Some(path);
        client.get().try_send(call.create_response(()).to_msg());
        drop(client);

        self.send_notify_c(notify).await;
    }

    async fn handle_continue_path(&self, id: ClientID, mut call: Call<ContinuePath>) {
        let mut client = self.get_client(&id).await;
        let Some(path) = &mut client.get_mut().path_state else {
            todo!()
        };

        for handle in &mut path.listeners {
            handle.add_items(&call.params.points);
        }

        path.nodes.append(&mut call.params.points);

        tokio::task::yield_now().await;

        let now = Instant::now();

        debug!(
            "now {:?}, last flush {:?}, diff {:?}",
            now,
            path.last_flush,
            now - path.last_flush
        );

        if now - path.last_flush > super::PATH_FLUSH_TIME {
            for handle in &mut path.listeners {
                handle.flush_response();
            }

            path.last_flush = now;
        }

        client.get().try_send(call.create_response(()).to_msg());
    }

    async fn handle_end_path(&self, id: ClientID, call: Call<EndPath>) {
        let path = {
            let mut client = self.get_client(&id).await;
            client.get_mut().path_state.take()
        };

        let Some(path) = path else { todo!() };

        for handle in path.listeners {
            handle.finalize();
        }

        let item = PathItem {
            transform: Transform::default(),
            path: Spline { points: path.nodes },
            stroke: path.stroke,
        };

        let item_id = self
            .canvas
            .add_item(crate::canvas::Item::Path(item.clone()))
            .await;

        self.send_notify_c(ItemCreated {
            id: item_id,
            item: item.to_item(),
        })
        .await;

        self.get_client(&id)
            .await
            .get()
            .try_send(call.create_response(item_id).to_msg());
    }

    async fn handle_get_all_client_info(&self, id: ClientID, call: Call<GetAllClientInfo>) {
        let mut out = std::collections::BTreeMap::new();
        let client_ids = self.client_ids.read().await;
        for id in client_ids.iter() {
            let info = self.get_client(id).await.get().info.clone();
            out.insert(*id, info);
        }
        drop(client_ids);
        let client = self.get_client(&id).await;
        client
            .get()
            .try_send(call.create_response(ClientTable(out)).to_msg());
    }
}
