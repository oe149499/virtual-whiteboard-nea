//! Implementation of boards stored on disk;

use clap::builder::Str;
use log::{debug, trace};
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeSet,
    ffi::{OsStr, OsString},
    fs::DirEntry,
    io::{self, Seek, Write},
    path::{Path, PathBuf},
};

use crate::{
    canvas::{ActiveCanvas, Item},
    utils::IterExt,
    GlobalRes,
};

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

    pub async fn load_canvas(&mut self) -> io::Result<ActiveCanvas> {
        // let mut data = String::new();
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

        serde_json::to_writer(&file, &self.attrs).expect("Failed to serialize attrs");
        file.seek(io::SeekFrom::Current(-1))
            .expect("Failed to seek to after attrs");
        file.write(br#","items":["#).unwrap();

        canvas
            .scan_items(|id, item| {
                if !seen_ids.contains(&id) {
                    trace!("Serialising item {id:?} during autosave");
                    seen_ids.insert(id);
                    serde_json::to_writer(&file, item).expect("Failed to serialize item");
                    file.write(b",").unwrap();
                }
            })
            .await;

        file.seek(io::SeekFrom::Current(-1)).unwrap();

        file.write(b"]}").unwrap();

        file.sync_all().unwrap();

        drop(file);

        std::fs::remove_file(&self.file_path);

        std::fs::rename(&self.temp_path, &self.file_path).expect("Failed to overwrite board file");

        Ok(())
    }
}

fn try_get_board(entry: DirEntry) -> Option<(String, BoardFileHandle)> {
    let path = entry.path();
    let file_name = path.file_name()?.to_str()?;
    if let Some(name) = file_name.strip_suffix(".json") {
        Some((name.to_string(), BoardFileHandle::from_path(path)))
    } else {
        None
    }
}

pub fn get_boards(path: &Path) -> io::Result<Vec<(String, BoardFileHandle)>> {
    use std::fs;

    let mut handles = Vec::new();

    let dirs = fs::read_dir(path)?;
    for entry in dirs.filter_ok() {
        debug!("Scanning entry: {entry:?}");
        if let Some(board) = try_get_board(entry) {
            debug!("Found board file");
            handles.push(board)
        }
    }

    Ok(handles)
}
