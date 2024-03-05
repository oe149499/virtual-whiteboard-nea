//! Implementation of boards stored on disk;

use clap::builder::OsStr;
use log::{debug, trace};
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeSet,
    fs::DirEntry,
    io::{self, Seek, Write},
    path::{Path, PathBuf},
};

use crate::{
    canvas::{ActiveCanvas, Item},
    utils::IterExt,
};

/// Helper for `serde(default)`
const fn _true() -> bool {
    true
}

#[derive(Serialize, Deserialize)]
struct BoardFileAttrs {
    #[serde(default = "_true")]
    pub readonly: bool,
}

#[derive(Serialize, Deserialize)]
struct BoardFile {
    pub items: Vec<Item>,
    #[serde(flatten)]
    pub attrs: BoardFileAttrs,
}

pub struct BoardFileHandle {
    file_path: PathBuf,
    temp_path: PathBuf,
    attrs: BoardFileAttrs,
}

impl BoardFileHandle {
    pub fn from_path(file_path: PathBuf) -> Self {
        Self {
            temp_path: file_path.with_extension("json.swp"),
            file_path,
            attrs: BoardFileAttrs { readonly: true },
        }
    }

    /// Create a handle for a board which may not exist on the filesystem
    pub fn create_new(root: &Path, name: &str) -> Self {
        let file_name = filenamify::filenamify(name).replace('.', "_");
        let mut file_path = root.join(file_name);
        file_path.set_extension("json");
        Self::from_path(file_path)
    }

    fn try_get_board(entry: DirEntry) -> Option<(String, Self)> {
        let path = entry.path();
        let file_name = path.file_name()?.to_str()?;
        if let Some(name) = file_name.strip_suffix(".json") {
            Some((name.to_string(), BoardFileHandle::from_path(path)))
        } else {
            None
        }
    }

    pub fn get_boards(path: &Path) -> io::Result<Vec<(String, Self)>> {
        use std::fs;

        let mut handles = Vec::new();

        let dirs = fs::read_dir(path)?;
        for entry in dirs.filter_ok() {
            if let Some(board) = Self::try_get_board(entry) {
                handles.push(board)
            }
        }

        Ok(handles)
    }

    pub async fn load_canvas(&mut self) -> io::Result<ActiveCanvas> {
        let data = tokio::fs::read(&self.file_path).await?;

        let parsed = serde_json::from_slice::<BoardFile>(&data).map_err(|e| {
            debug!("Error parsing board file: {e}");
            e
        })?;

        let mut canvas = ActiveCanvas::new_empty();

        for item in parsed.items {
            canvas.add_item_owned(item);
        }

        self.attrs = parsed.attrs;

        Ok(canvas)
    }

    pub async fn save_canvas(&mut self, canvas: &ActiveCanvas) -> io::Result<()> {
        let mut seen_ids = BTreeSet::new();

        let mut file = std::fs::File::create(&self.temp_path)?;

        serde_json::to_writer(&file, &self.attrs)?;
        // Clear the closing brace and start the item list
        file.seek(io::SeekFrom::Current(-1))?;
        file.write(br#","items":["#)?;

        canvas
            .scan_items(|id, item| {
                if !seen_ids.contains(&id) {
                    trace!("Serialising item {id:?} during autosave");
                    seen_ids.insert(id);
                    serde_json::to_writer(&file, item);
                    file.write(b",");
                }
            })
            .await;

        file.seek(io::SeekFrom::Current(-1)).unwrap();

        file.write(b"]}").unwrap();

        file.sync_all().unwrap();

        drop(file);

        std::fs::rename(&self.temp_path, &self.file_path).expect("Failed to overwrite board file");

        Ok(())
    }
}
