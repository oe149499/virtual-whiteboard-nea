//! An implementation of a currently active canvas

use std::{
    collections::BTreeSet,
    ops::{Deref, DerefMut},
    sync::atomic::{AtomicU32, Ordering},
};

use scc::hash_map::OccupiedEntry;
use tokio::sync::RwLock;

use crate::message::ItemID;

use super::Item;

/// An open canvas
pub struct ActiveCanvas {
    next_id: AtomicU32,
    item_ids: RwLock<BTreeSet<ItemID>>,
    items: scc::HashMap<ItemID, Item>,
}

struct ItemRef<'a>(OccupiedEntry<'a, ItemID, Item>);

impl<'a> Deref for ItemRef<'a> {
    type Target = Item;
    fn deref(&self) -> &Self::Target {
        self.0.get()
    }
}

impl<'a> DerefMut for ItemRef<'a> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        self.0.get_mut()
    }
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

    /// Get a reference to an item on the canvas
    pub async fn get_ref(&self, id: ItemID) -> Option<impl Deref<Target = Item> + '_> {
        Some(ItemRef(self.items.get_async(&id).await?))
    }

    /// Get a mutable reference to an item
    pub async fn get_ref_mut(&self, id: ItemID) -> Option<impl DerefMut<Target = Item> + '_> {
        Some(ItemRef(self.items.get_async(&id).await?))
    }

    /// Retrieve the specified item if present
    pub async fn get_item(&self, id: ItemID) -> Option<Item> {
        Some(self.items.get_async(&id).await?.get().clone())
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

    /// Get a vector of all current Item IDs
    pub async fn get_item_ids(&self) -> Vec<ItemID> {
        self.item_ids.read().await.iter().cloned().collect()
    }
}
