//! An implementation of a currently active canvas

use std::{
    collections::BTreeSet,
    ops::{Deref, DerefMut},
    sync::atomic::{AtomicU32, Ordering},
};

use scc::hash_map::OccupiedEntry;
use tokio::sync::RwLock;

use crate::{message::ItemID, utils::CounterU64};

use super::Item;

/// An open canvas
pub struct ActiveCanvas {
    next_id: AtomicU32,
    item_ids: RwLock<BTreeSet<ItemID>>,
    items: scc::HashMap<ItemID, Item>,
    edit_count: CounterU64,
}

/// A lock-holding reference to an item on the board
pub struct ItemRef<'a>(OccupiedEntry<'a, ItemID, Item>, &'a CounterU64);

impl<'a> Deref for ItemRef<'a> {
    type Target = Item;
    fn deref(&self) -> &Self::Target {
        self.0.get()
    }
}

impl<'a> DerefMut for ItemRef<'a> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        self.1.next();
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
            edit_count: CounterU64::new(),
        }
    }

    fn get_id(&self) -> ItemID {
        let val = self.next_id.fetch_add(1, Ordering::Relaxed);
        ItemID(val)
    }

    /// Get a reference to an item on the canvas
    pub async fn get_ref(&self, id: ItemID) -> Option<ItemRef> {
        Some(ItemRef(self.items.get_async(&id).await?, &self.edit_count))
    }

    // /// Get a mutable reference to an item
    // pub async fn get_ref_mut(&self, id: ItemID) -> Option<impl DerefMut<Target = Item> + '_> {
    //     Some(ItemRef(self.items.get_async(&id).await?))
    // }

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
        self.edit_count.next();
        id
    }

    /// Insert a new item synchronously from an exclusive reference
    pub fn add_item_owned(&mut self, item: Item) -> ItemID {
        let id = self.get_id();
        self.items
            .insert(id, item)
            .expect("Duplicate Item ID, something is wrong");
        self.item_ids.get_mut().insert(id);
        id
    }

    pub async fn scan_items(&self, mut f: impl FnMut(ItemID, &Item)) {
        self.items.scan_async(|&id, item| f(id, item)).await
    }

    /// Get a vector of all current Item IDs
    pub async fn get_item_ids(&self) -> Vec<ItemID> {
        self.item_ids.read().await.iter().cloned().collect()
    }

    pub fn get_item_ids_sync(&self) -> Result<Vec<ItemID>, ()> {
        let ids = self.item_ids.try_read().or(Err(()))?;
        Ok(ids.iter().cloned().collect())
    }
}
