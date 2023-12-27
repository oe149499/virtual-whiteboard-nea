use std::collections;

use crate::message::{
    self,
    method::*,
    notify_c::{ItemCreated, SelectionItemsAdded},
    ClientID, ClientTable, ErrorCode,
};

use super::Board;

impl Board {
    pub async fn handle_method(&self, id: ClientID, method: Methods) {
        match method {
            Methods::SelectionAddItems(call) => self.handle_selection_add_items(id, call).await,
            Methods::SelectionRemoveItems(_) => todo!(),
            Methods::EditBatchItems(_) => todo!(),
            Methods::EditSingleItem(_) => todo!(),
            Methods::DeleteItems(_) => todo!(),
            Methods::CreateItem(call) => self.handle_create_item(id, call).await,
            Methods::BeginPath(_) => todo!(),
            Methods::ContinuePath(_) => todo!(),
            Methods::EndPath(_) => todo!(),
            Methods::GetAllItemIDs(_) => todo!(),
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
