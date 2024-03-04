use scc::hash_map::OccupiedEntry;

use crate::{
    client::{ClientHandle, MessagePayload},
    message::{
        iterate::{IterateHandle, IterateType},
        method::{MethodHandle, MethodType},
        notify_c::NotifyCType,
        reject::{
            helpers::{non_existent_id, resource_not_owned},
            RejectReason,
        },
        ClientID, ItemID,
    },
};

use super::{Board, ClientState};

/// Common interface of method and iterate handles
trait Handle {
    fn send_error(self, reason: RejectReason);
    fn send_warn(&self, reason: RejectReason);
}

impl<T: MethodType> Handle for MethodHandle<T> {
    fn send_error(self, reason: RejectReason) {
        self.error(reason)
    }

    fn send_warn(&self, reason: RejectReason) {
        self.warn(reason)
    }
}

impl<T: IterateType> Handle for IterateHandle<T> {
    fn send_error(self, reason: RejectReason) {
        self.error(reason)
    }
    fn send_warn(&self, reason: RejectReason) {
        self.warn(reason)
    }
}

pub enum TakeResult {
    Successful,
    NonExistent,
    Occupied,
    AlreadyOwned,
}

#[allow(private_bounds)]
impl Board {
    /// Check if the current item is already selected by the specified item and send a warning if it is not
    pub async fn check_owned(&self, id: &ClientID, handle: &impl Handle, item_id: ItemID) -> bool {
        let entry = self.selected_items.get_async(&item_id).await;
        if let Some(entry) = entry {
            if entry.get().as_ref() == Some(id) {
                true
            } else {
                handle.send_warn(resource_not_owned(item_id));
                false
            }
        } else {
            handle.send_warn(non_existent_id(item_id));
            false
        }
    }

    /// Attempt to mark the item as selected by the specified client
    pub async fn take_item(
        &self,
        id: &ClientID,
        handle: &impl Handle,
        item_id: ItemID,
    ) -> TakeResult {
        let entry = self.selected_items.get_async(&item_id).await;
        let Some(mut entry) = entry else {
            handle.send_warn(non_existent_id(item_id));
            return TakeResult::NonExistent;
        };
        let value = entry.get_mut();
        match value {
            None => {
                *value = Some(*id);
                TakeResult::Successful
            }
            Some(owner_id) => {
                if owner_id == id {
                    TakeResult::AlreadyOwned
                } else {
                    TakeResult::Occupied
                }
            }
        }
    }

    /// Assume the client is registered and retrieve the associated entry
    pub async fn get_client(&self, id: &ClientID) -> OccupiedEntry<'_, ClientID, ClientState> {
        self.clients
            .get_async(id)
            .await
            .expect("Missing client ID, something is very wrong")
    }

    pub async fn get_handle(&self, id: &ClientID) -> Option<ClientHandle> {
        self.clients.get_async(id).await?.get().handle.clone()
    }

    pub async fn send_notify_c(&self, msg: impl NotifyCType) {
        let msg = msg.as_notify().as_msg();
        let payload = MessagePayload::new(&msg);
        for id in self.client_ids.read().await.iter() {
            self.get_client(id).await.get().try_send_payload(&payload)
        }
    }
}

impl ClientState {
    pub fn try_send_payload(&self, payload: &MessagePayload) {
        if let Some(handle) = &self.handle {
            handle.send_payload(payload);
        }
    }
}
