use std::collections::{self, BTreeMap};

use tokio::time::Instant;

use crate::{
    canvas::{item::PathItem, Spline, Transform},
    client,
    message::{
        self,
        method::*,
        notify_c::{
            ItemCreated, PathStarted, SelectionItemsAdded, SelectionMoved, SingleItemEdited,
        },
        reject::helpers::{non_existent_id, resource_not_owned},
        ClientID, ErrorCode, PathID,
    },
};

use super::{ActivePath, Board, SelectionState};

impl Board {
    pub async fn handle_method(&self, id: ClientID, method: Methods) {
        match method {
            Methods::SelectionAddItems(call) => self.handle_selection_add_items(id, call).await,
            Methods::SelectionRemoveItems(call) => {
                self.handle_selection_remove_items(id, call).await
            }
            Methods::SelectionMove(call) => self.handle_selection_move(id, call).await,
            Methods::EditBatchItems(call) => self.handle_edit_batch_items(id, call).await,
            Methods::EditSingleItem(call) => self.handle_edit_single_item(id, call).await,
            Methods::DeleteItems(call) => self.handle_delete_items(id, call).await,
            Methods::CreateItem(call) => self.handle_create_item(id, call).await,
            Methods::BeginPath(call) => self.handle_begin_path(id, call).await,
            Methods::ContinuePath(call) => self.handle_continue_path(id, call).await,
            Methods::EndPath(call) => self.handle_end_path(id, call).await,
            Methods::GetAllItemIDs(call) => self.handle_get_all_item_ids(id, call).await,
            // Methods::GetAllClientInfo(call) => self.handle_get_all_client_info(id, call).await,
            Methods::GetClientState(call) => self.handle_get_client_state(id, call).await,
        }
    }

    async fn handle_selection_add_items(&self, id: ClientID, call: Call<SelectionAddItems>) {
        let (params, handle) = call.create_handle(self.get_handle(&id).await);
        let mut result = Vec::with_capacity(params.new_items.len());
        let mut successful_ids = collections::BTreeSet::new();
        for &item_id in params.new_items.keys() {
            let item = self.selected_items.entry_async(item_id).await;
            match item {
                scc::hash_map::Entry::Occupied(mut entry) => {
                    let value = entry.get_mut();
                    if value == &None {
                        *value = Some(id);
                        result.push(message::Ok(()));
                        successful_ids.insert(item_id);
                    } else {
                        result.push(message::Err(ErrorCode::NotAvailable.into()));
                    }
                }
                scc::hash_map::Entry::Vacant(entry) => {
                    entry.insert_entry(Some(id));
                    result.push(message::Ok(()));
                    successful_ids.insert(item_id);
                }
            }
        }

        for item_id in params.existing_items.keys() {
            let Some(item) = self.selected_items.get_async(item_id).await else {
                return handle.error(non_existent_id(*item_id));
            };
            if *item.get() != Some(id) {
                return handle.error(resource_not_owned(*item_id));
            }
        }

        let mut new_items = params.existing_items;
        new_items.extend(params.new_items);

        handle.respond(result);
        {
            let mut client = self.get_client(&id).await;
            client.get_mut().selection = SelectionState {
                own_transform: params.selection_transform,
                items: new_items.clone(),
            };
        }

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
                handle.warn(non_existent_id(item_id));
                ok = false;
                continue;
            };
            if *item.get() == Some(client_id) {
                let item = self.canvas.get_ref_mut(item_id).await;
                let Some(mut item) = item else { continue };
                let res = item.apply_location_update(item_id, &update);
                if let Err((update, reason)) = res {
                    out.insert(item_id, update);
                    handle.warn(reason);
                } else {
                    out.insert(item_id, update);
                }
            } else {
                handle.warn(resource_not_owned(item_id));
                ok = false;
            }
        }

        for id in out.keys() {
            client.get_mut().selection.items.remove(id);
        }

        if ok {
            handle.ok(());
        } else {
            handle.err(ErrorCode::BadData.into())
        }
    }

    async fn handle_selection_move(&self, id: ClientID, call: Call<SelectionMove>) {
        let (params, handle) = call.create_handle(self.get_handle(&id).await);

        self.send_notify_c(SelectionMoved {
            id,
            transform: params.transform,
        })
        .await;

        handle.respond(());
    }

    async fn handle_edit_batch_items(&self, id: ClientID, call: Call<EditBatchItems>) {}

    async fn handle_edit_single_item(&self, id: ClientID, call: Call<EditSingleItem>) {
        let (params, handle) = call.create_handle(self.get_handle(&id).await);

        let selected = self.selected_items.get_async(&params.item_id).await;

        let Some(selected) = selected else {
            return handle.error(non_existent_id(params.item_id));
        };

        if selected.get() != &Some(id) {
            return handle.error(resource_not_owned(params.item_id));
        }

        let mut item = self.canvas.get_ref_mut(params.item_id).await.unwrap(); // Checked earlier that item exists
        *item = params.item.clone();

        handle.ok(());

        self.send_notify_c(SingleItemEdited {
            id: params.item_id,
            item: params.item,
        })
        .await;
    }

    async fn handle_delete_items(&self, id: ClientID, call: Call<DeleteItems>) {}

    async fn handle_create_item(&self, id: ClientID, call: Call<CreateItem>) {
        let (params, handle) = call.create_handle(self.get_handle(&id).await);
        let item_id = self.canvas.add_item(params.item.clone()).await;

        self.selected_items
            .insert_async(item_id, None)
            .await
            .unwrap(); // New ID was just created

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
            client: id,
            nodes: Vec::new(),
            listeners: Default::default(),
            stroke: params.stroke.clone(),
            last_flush: Instant::now(),
        };

        let path_id = PathID::new();

        self.active_paths
            .insert_async(path_id, path)
            .await
            .expect("PathIDs should always be unique");

        handle.respond(path_id);

        self.send_notify_c(PathStarted {
            client: id,
            stroke: params.stroke,
            path: path_id,
        })
        .await;
    }

    async fn handle_continue_path(&self, id: ClientID, call: Call<ContinuePath>) {
        let (mut params, handle) = call.create_handle(self.get_handle(&id).await);

        let entry = self.active_paths.get_async(&params.path_id).await;

        let Some(mut entry) = entry else {
            return handle.error(non_existent_id(params.path_id));
        };
        let path = entry.get_mut();

        if path.client != id {
            return handle.error(resource_not_owned(params.path_id));
        }

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
        let (params, handle) = call.create_handle(self.get_handle(&id).await);

        let entry = self.active_paths.get_async(&params.path_id).await;

        let Some(entry) = entry else {
            return handle.error(non_existent_id(params.path_id));
        };

        let path = entry.remove();

        if path.client != id {
            return handle.error(resource_not_owned(params.path_id));
        }

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

    // async fn handle_get_all_client_info(&self, id: ClientID, call: Call<GetAllClientInfo>) {
    //     let (_, handle) = call.create_handle(self.get_handle(&id).await);
    //     let mut out = std::collections::BTreeMap::new();
    //     let client_ids = self.client_ids.read().await;
    //     for id in client_ids.iter() {
    //         let info = self.get_client(id).await.get().info.clone();
    //         out.insert(*id, info);
    //     }
    //     handle.respond(out);
    // }
    async fn handle_get_client_state(&self, id: ClientID, call: Call<GetClientState>) {
        let (params, handle) = call.create_handle(self.get_handle(&id).await);

        let target = self.clients.get_async(&params.client_id).await;

        let Some(target) = target else {
            return handle.error(non_existent_id(params.client_id));
        };

        let target = target.get();

        let result = message::ClientState {
            info: target.info.clone(),
            paths: target.active_paths.clone(),
            selected_items: target
                .selection
                .items
                .iter()
                .map(|(&a, b)| (a, b.clone()))
                .collect(),
            selection_transform: target.selection.own_transform.clone(),
        };

        handle.respond(result);
    }
}
