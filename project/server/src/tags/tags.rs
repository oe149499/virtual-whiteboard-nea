//! THe tag system: Indexing, searching and handling endpoints

use serde::{Deserialize, Serialize};
#[cfg(feature = "codegen")]
use ts_rs::TS;

/// A unique ID for a tag type
#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "codegen", derive(TS))]
pub struct TagID(usize);
