use crate::message::{
    self,
    iterate::{GetActivePath, GetFullItems, IterateCall, Iterates},
    ClientID,
};

use super::Board;

impl Board {
    pub async fn handle_iterate(&self, id: ClientID, call: Iterates) {
        match call {
            Iterates::GetFullItems(call) => self.handle_get_full_items(id, call).await,
            Iterates::GetActivePath(call) => self.handle_get_active_path(id, call).await,
        }
    }

    async fn handle_get_full_items(&self, id: ClientID, call: IterateCall<GetFullItems>) {
        let (params, mut handle) = call.get_handle(self.get_client(&id).await.get().handle.clone());

        for (idx, id) in params.ids.into_iter().enumerate() {
            if let Some(item) = self.canvas.get_item(id).await {
                handle.add_item(message::Ok((id, item)));
            } else {
                handle.add_item(message::Err(message::ErrorCode::NotFound.into()));
            }
            if idx % 16 == 0 {
                handle.flush_response();
            }
        }
        handle.finalize();
    }

    async fn handle_get_active_path(&self, id: ClientID, call: IterateCall<GetActivePath>) {
        let (params, mut handle) = call.get_handle(self.get_client(&id).await.get().handle.clone());

        let entry = self.active_paths.get_async(&params.path).await;
        let Some(mut entry) = entry else { todo!() };
        let path = entry.get_mut();

        handle.add_items(&path.nodes).flush_response();

        path.listeners.push(handle);
    }
}
