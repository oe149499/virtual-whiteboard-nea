//! An implementation of a currently active canvas

use std::{
    collections::BTreeSet,
    sync::atomic::{AtomicU32, Ordering},
};

use tokio::sync::RwLock;

use crate::message::ItemID;

use super::Item;

/// An open canvas
pub struct ActiveCanvas {
    next_id: AtomicU32,
    item_ids: RwLock<BTreeSet<ItemID>>,
    items: scc::HashMap<ItemID, Item>,
}

impl ActiveCanvas {
    /// Create a new empty canvas
    pub fn new_empty() -> Self {
        Self {
            next_id: AtomicU32::new(1),
            item_ids: Default::default(),
            items: Default::default(),
        }
    }

    fn get_id(&self) -> ItemID {
        let val = self.next_id.fetch_add(1, Ordering::Relaxed);
        ItemID(val)
    }

    /// Insert a new item on the canvas and return an ID for it
    pub async fn add_item(&self, item: Item) -> ItemID {
        let id = self.get_id();
        self.items
            .insert_async(id, item)
            .await
            .expect("Duplicate Item ID, something is wrong");
        self.item_ids.write().await.insert(id);
        id
    }
}
