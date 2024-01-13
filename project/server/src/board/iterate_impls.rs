use crate::message::{
    self,
    iterate::{Count, GetActivePath, GetFullItems, IterateCall, Iterates},
    ClientID,
};

use super::Board;

impl Board {
    pub async fn handle_iterate(&self, id: ClientID, call: Iterates) {
        match call {
            Iterates::Count(call) => self.handle_count(id, call).await,
            Iterates::GetPartialItems(_) => todo!(),
            Iterates::GetFullItems(call) => self.handle_get_full_items(id, call).await,
            Iterates::GetActivePath(call) => self.handle_get_active_path(id, call).await,
        }
    }

    async fn handle_count(&self, id: ClientID, call: IterateCall<Count>) {
        let (params, mut handle) = call.get_handle(self.get_client(&id).await.get().handle.clone());

        for i in params.from..=params.to {
            handle.add_item(i);
            if rand::random::<u8>() < 16 {
                handle.flush_response();
            }
        }
        handle.finalize();
    }

    async fn handle_get_full_items(&self, id: ClientID, call: IterateCall<GetFullItems>) {
        let (params, mut handle) = call.get_handle(self.get_client(&id).await.get().handle.clone());

        for (idx, id) in params.ids.into_iter().enumerate() {
            if let Some(item) = self.canvas.get_item(id).await {
                handle.add_item(message::Ok(item));
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
        let client = self.clients.get_async(&params.client).await;

        let Some(mut client) = client else { todo!() };
        let Some(path) = &mut client.get_mut().path_state else {
            todo!()
        };

        handle.add_items(&path.nodes).flush_response();

        path.listeners.push(handle);
    }
}
