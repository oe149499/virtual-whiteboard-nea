use log::debug;
use scc::hash_map::Entry;
use tokio::time::Instant;

use crate::{
    canvas::{item::PathItem, Spline, Transform},
    message::{
        self as m,
        method::*,
        notify_c::{
            ItemCreated, ItemsDeleted, PathStarted, SelectionItemsAdded, SelectionItemsRemoved,
            SelectionMoved, SingleItemEdited,
        },
        reject::helpers::{non_existent_id, resource_not_owned},
        ClientID, ErrorCode, PathID,
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
            Methods::SelectionMove(call) => self.handle_selection_move(id, call).await,
            Methods::EditSingleItem(call) => self.handle_edit_single_item(id, call).await,
            Methods::DeleteItems(call) => self.handle_delete_items(id, call).await,
            Methods::CreateItem(call) => self.handle_create_item(id, call).await,
            Methods::BeginPath(call) => self.handle_begin_path(id, call).await,
            Methods::ContinuePath(call) => self.handle_continue_path(id, call).await,
            Methods::EndPath(call) => self.handle_end_path(id, call).await,
            Methods::GetAllItemIDs(call) => self.handle_get_all_item_ids(id, call).await,
            Methods::GetAllClientIDs(call) => self.handle_get_all_client_ids(id, call).await,
            Methods::GetClientState(call) => self.handle_get_client_state(id, call).await,
        }
    }

    async fn make_handle<T: MethodType>(
        &self,
        id: ClientID,
        call: Call<T>,
    ) -> (T, MethodHandle<T>) {
        call.create_handle(self.get_handle(&id).await)
    }

    async fn handle_selection_add_items(&self, id: ClientID, call: Call<SelectionAddItems>) {
        let (params, handle) = call.create_handle(self.get_handle(&id).await);

        let mut old_sits_checked = Vec::with_capacity(params.old_sits.len());

        for entry in params.old_sits {
            if self.check_owned(&id, &handle, entry.0).await {
                old_sits_checked.push(entry);
            }
        }

        let mut new_sits_checked = Vec::with_capacity(params.new_sits.len());

        let mut return_results = Vec::with_capacity(params.new_sits.len());

        for entry in params.new_sits {
            use super::active_helpers::TakeResult::*;
            match self.take_item(&id, &handle, entry.0).await {
                Successful => {
                    return_results.push(m::Ok(()));
                    new_sits_checked.push(entry);
                }
                NonExistent => {
                    return_results.push(m::Err(ErrorCode::NotFound.into()));
                }
                Occupied => {
                    return_results.push(m::Err(ErrorCode::NotAvailable.into()));
                }
                AlreadyOwned => {
                    return_results.push(m::Ok(()));
                    new_sits_checked.push(entry);
                }
            }
        }

        let new_ids = new_sits_checked.iter().map(|&(i, _)| i).collect();

        let sits = new_sits_checked.iter().chain(old_sits_checked.iter());

        let mut client = self.get_client(&id).await;
        let selection = &mut client.get_mut().selection;

        selection.own_transform = params.new_srt.clone();

        for (item_id, transform) in sits.cloned() {
            selection.items.insert(item_id, transform);
        }

        drop(client);

        handle.respond(return_results);

        self.send_notify_c(SelectionItemsAdded {
            id,
            items: new_ids,
            new_srt: params.new_srt,
        })
        .await
    }

    async fn handle_selection_remove_items(
        &self,
        client_id: ClientID,
        call: Call<SelectionRemoveItems>,
    ) {
        let (params, handle) = call.create_handle(self.get_handle(&client_id).await);

        let mut client = self.get_client(&client_id).await;

        let mut out = Vec::new();

        let mut ok = true;

        for (item_id, update) in params.items {
            let entry = self.selected_items.entry_async(item_id).await;
            let Entry::Occupied(mut entry) = entry else {
                handle.warn(non_existent_id(item_id));
                ok = false;
                continue;
            };
            if *entry.get() == Some(client_id) {
                let item = self.canvas.get_ref(item_id).await;
                let Some(mut item) = item else { continue };
                let res = item.apply_location_update(item_id, &update);
                *entry.get_mut() = None;
                if let Err((update, reason)) = res {
                    out.push((item_id, update));
                    handle.warn(reason);
                } else {
                    out.push((item_id, update));
                }
            } else {
                handle.warn(resource_not_owned(item_id));
                ok = false;
            }
        }

        for (id, _) in out.iter() {
            client.get_mut().selection.items.remove(id);
        }

        drop(client);

        if ok {
            handle.ok(());
        } else {
            handle.err(ErrorCode::BadData.into())
        }

        self.send_notify_c(SelectionItemsRemoved {
            id: client_id,
            items: out,
        })
        .await;
    }

    async fn handle_selection_move(&self, id: ClientID, call: Call<SelectionMove>) {
        let (params, handle) = call.create_handle(self.get_handle(&id).await);

        let new_sits;

        if let Some(sits) = params.new_sits {
            let mut new_sits_checked = Vec::with_capacity(sits.len());

            for entry in sits {
                if self.check_owned(&id, &handle, entry.0).await {
                    new_sits_checked.push(entry);
                }
            }

            new_sits = Some(new_sits_checked);
        } else {
            new_sits = None;
        }

        {
            let mut client = self.get_client(&id).await;
            let selection = &mut client.get_mut().selection;

            selection.own_transform = params.new_srt.clone();

            for (item_id, transform) in new_sits.iter().flatten() {
                selection.items.insert(*item_id, transform.clone());
            }
        }

        self.send_notify_c(SelectionMoved {
            id,
            transform: params.new_srt,
            new_sits,
        })
        .await;

        handle.respond(());
    }

    async fn handle_edit_single_item(&self, id: ClientID, call: Call<EditSingleItem>) {
        let (params, handle) = call.create_handle(self.get_handle(&id).await);

        let selected = self.selected_items.get_async(&params.item_id).await;

        let Some(selected) = selected else {
            return handle.error(non_existent_id(params.item_id));
        };

        if selected.get() != &Some(id) {
            return handle.error(resource_not_owned(params.item_id));
        }

        drop(selected);

        debug!("Editing item {:?}", params.item_id);

        let mut item = self.canvas.get_ref(params.item_id).await.unwrap(); // Checked earlier that item exists
        *item = params.item.clone();

        handle.ok(());

        self.send_notify_c(SingleItemEdited {
            id: params.item_id,
            item: params.item,
        })
        .await;
    }

    async fn handle_delete_items(&self, id: ClientID, call: Call<DeleteItems>) {
        let (params, handle) = self.make_handle(id, call).await;

        let mut removed = Vec::with_capacity(params.ids.len());

        for item_id in params.ids {
            if self.check_owned(&id, &handle, item_id).await {
                self.selected_items.remove_async(&item_id).await;
                removed.push(item_id);
            }
        }

        let mut client = self.get_client(&id).await;
        for item_id in removed.iter() {
            client.get_mut().selection.items.remove(&item_id);
        }
        drop(client);

        for &item_id in removed.iter() {
            self.canvas.delete_item(item_id).await;
        }

        handle.respond(());

        self.send_notify_c(ItemsDeleted { ids: removed }).await;
    }

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

            self.selected_items
                .insert_async(item_id, None)
                .await
                .expect("Item ID should be unique");

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

    async fn handle_get_all_client_ids(&self, id: ClientID, call: Call<GetAllClientIDs>) {
        let (_, handle) = call.create_handle(self.get_handle(&id).await);
        let ids = self.client_ids.read().await.iter().cloned().collect();
        handle.respond(ids);
    }

    async fn handle_get_client_state(&self, id: ClientID, call: Call<GetClientState>) {
        let (params, handle) = call.create_handle(self.get_handle(&id).await);

        let target = self.clients.get_async(&params.client_id).await;

        let Some(target) = target else {
            return handle.error(non_existent_id(params.client_id));
        };

        let target = target.get();

        let result = m::ClientState {
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
