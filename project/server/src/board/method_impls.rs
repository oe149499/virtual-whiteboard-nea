use crate::message::{method::*, notify_c::ItemCreated, ClientID, ClientTable};

use super::Board;

impl Board {
    pub async fn handle_method(&self, id: ClientID, method: Methods) {
        match method {
            Methods::SelectionAddItems(_) => todo!(),
            Methods::SelectionRemoveItems(_) => todo!(),
            Methods::EditBatchItems(_) => todo!(),
            Methods::EditSingleItem(_) => todo!(),
            Methods::DeleteItems(_) => todo!(),
            Methods::CreateItem(call) => self.handle_create_item(id, call).await,
            Methods::GetAllClientInfo(call) => self.handle_get_all_client_info(id, call).await,
        }
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
            .try_send(call.create_ok(ClientTable(out)).to_msg());
    }
}
