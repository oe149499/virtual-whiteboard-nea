//! THe tag system: Indexing, searching and handling endpoints

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// A unique ID for a tag type
#[derive(Serialize, Deserialize, TS)]
pub struct TagID(usize);