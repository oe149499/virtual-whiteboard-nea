use crate::message::{
    iterate::{Count, GetActivePath, IterateCall, Iterates},
    ClientID,
};

use super::Board;

impl Board {
    pub async fn handle_iterate(&self, id: ClientID, call: Iterates) {
        match call {
            Iterates::Count(call) => self.handle_count(id, call).await,
            Iterates::GetPartialItems(_) => todo!(),
            Iterates::GetFullItems(_) => todo!(),
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
