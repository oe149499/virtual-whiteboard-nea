use std::collections::{self, BTreeMap};

use tokio::time::Instant;

use crate::{
    canvas::{item::PathItem, Spline, Transform},
    message::{
        self,
        method::*,
        notify_c::{ItemCreated, PathStarted, SelectionItemsAdded},
        ClientID, ErrorCode,
    },
};

use super::{ActivePath, Board};

impl Board {
    pub async fn handle_method(&self, id: ClientID, method: Methods) {
        match method {
            Methods::SelectionAddItems(call) => self.handle_selection_add_items(id, call).await,
            Methods::SelectionRemoveItems(call) => {
                self.handle_selection_remove_items(id, call).await
            }
            Methods::EditBatchItems(call) => self.handle_edit_batch_items(id, call).await,
            Methods::EditSingleItem(call) => self.handle_edit_single_item(id, call).await,
            Methods::DeleteItems(call) => self.handle_delete_items(id, call).await,
            Methods::CreateItem(call) => self.handle_create_item(id, call).await,
            Methods::BeginPath(call) => self.handle_begin_path(id, call).await,
            Methods::ContinuePath(call) => self.handle_continue_path(id, call).await,
            Methods::EndPath(call) => self.handle_end_path(id, call).await,
            Methods::GetAllItemIDs(call) => self.handle_get_all_item_ids(id, call).await,
            Methods::GetAllClientInfo(call) => self.handle_get_all_client_info(id, call).await,
        }
    }

    async fn handle_selection_add_items(&self, id: ClientID, call: Call<SelectionAddItems>) {
        let (params, handle) = call.create_handle(self.get_handle(&id).await);
        let mut result = Vec::with_capacity(params.items.len());
        let mut successful_ids = collections::BTreeSet::new();
        for item_id in params.items {
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

        handle.respond(result);
        self.get_client(&id)
            .await
            .get_mut()
            .selection
            .extend(successful_ids.iter());

        self.send_notify_c(SelectionItemsAdded {
            id,
            items: successful_ids.into_iter().collect(),
        })
        .await;
    }

    async fn handle_selection_remove_items(
        &self,
        client_id: ClientID,
        call: Call<SelectionRemoveItems>,
    ) {
        let (params, handle) = call.create_handle(self.get_handle(&client_id).await);

        let mut client = self.get_client(&client_id).await;

        let mut out = BTreeMap::new();

        let mut ok = true;

        for (item_id, update) in params.items {
            let item = self.selected_items.get_async(&item_id).await;
            let Some(item) = item else {
                ok = false;
                continue;
            };
            if *item.get() == client_id {
                let item = self.canvas.get_ref_mut(item_id).await;
                let Some(mut item) = item else { continue };
                let update = item.apply_location_update(update);
                out.insert(item_id, update);
            } else {
                ok = false;
            }
        }

        for id in out.keys() {
            client.get_mut().selection.remove(id);
        }

        if ok {
            handle.ok(());
        } else {
            handle.err(ErrorCode::BadData.into())
        }
    }

    async fn handle_edit_batch_items(&self, id: ClientID, call: Call<EditBatchItems>) {}

    async fn handle_edit_single_item(&self, id: ClientID, call: Call<EditSingleItem>) {}

    async fn handle_delete_items(&self, id: ClientID, call: Call<DeleteItems>) {}

    async fn handle_create_item(&self, id: ClientID, call: Call<CreateItem>) {
        let (params, handle) = call.create_handle(self.get_handle(&id).await);
        let item_id = self.canvas.add_item(params.item.clone()).await;
        handle.respond(item_id);
        self.send_notify_c(ItemCreated {
            client: id,
            id: item_id,
            item: params.item,
        })
        .await;
    }

    async fn handle_begin_path(&self, id: ClientID, call: Call<BeginPath>) {
        let (params, handle) = call.create_handle(self.get_handle(&id).await);
        let path = ActivePath {
            nodes: Vec::new(),
            listeners: Default::default(),
            stroke: params.stroke.clone(),
            last_flush: Instant::now(),
        };

        {
            let mut client = self.get_client(&id).await;
            if let Some(_) = &client.get().path_state {
                todo!()
            }
            client.get_mut().path_state = Some(path);
        }

        handle.respond(());

        self.send_notify_c(PathStarted {
            id,
            stroke: params.stroke,
        })
        .await;
    }

    async fn handle_continue_path(&self, id: ClientID, call: Call<ContinuePath>) {
        let (mut params, handle) = call.create_handle(self.get_handle(&id).await);
        let mut client = self.get_client(&id).await;
        let Some(path) = &mut client.get_mut().path_state else {
            todo!()
        };

        handle.respond(());

        for handle in &mut path.listeners {
            handle.add_items(&params.points);
        }

        path.nodes.append(&mut params.points);

        tokio::task::yield_now().await;

        let now = Instant::now();

        if now - path.last_flush > super::PATH_FLUSH_TIME {
            for handle in &mut path.listeners {
                handle.flush_response();
            }

            path.last_flush = now;
        }
    }

    async fn handle_end_path(&self, id: ClientID, call: Call<EndPath>) {
        let (_, handle) = call.create_handle(self.get_handle(&id).await);

        let path = {
            let mut client = self.get_client(&id).await;
            client.get_mut().path_state.take()
        };

        let Some(path) = path else { todo!() };

        for handle in path.listeners {
            handle.finalize();
        }

        if path.nodes.len() > 0 {
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
                client: id,
                id: item_id,
                item: item.to_item(),
            })
            .await;

            handle.ok(item_id);
        } else {
            handle.err(ErrorCode::EmptyPath.into());
        }
    }

    async fn handle_get_all_item_ids(&self, id: ClientID, call: Call<GetAllItemIDs>) {
        let (_, handle) = call.create_handle(self.get_handle(&id).await);
        let ids = self.canvas.get_item_ids().await;
        handle.respond(ids);
    }

    async fn handle_get_all_client_info(&self, id: ClientID, call: Call<GetAllClientInfo>) {
        let (_, handle) = call.create_handle(self.get_handle(&id).await);
        let mut out = std::collections::BTreeMap::new();
        let client_ids = self.client_ids.read().await;
        for id in client_ids.iter() {
            let info = self.get_client(id).await.get().info.clone();
            out.insert(*id, info);
        }
        handle.respond(out);
    }
}
