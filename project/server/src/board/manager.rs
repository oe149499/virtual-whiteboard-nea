use std::{path::Path, sync::Arc};

use log::{debug, trace};
use scc::HashMap as AsyncHashMap;

use crate::canvas::ActiveCanvas;

use super::{active::from_canvas, file::BoardFileHandle, BoardHandle, WeakHandle};

static BOARD_TASKS: usize = 4;

struct LoadedState {
    handle: WeakHandle,
    canvas: Arc<ActiveCanvas>,
}

impl LoadedState {
    /// Either create a new active board or return the current one
    fn get_or_refresh(&mut self) -> BoardHandle {
        if let Some(handle) = self.handle.upgrade() {
            handle
        } else {
            let handle = from_canvas(self.canvas.clone(), BOARD_TASKS);
            self.handle = handle.downgrade();
            handle
        }
    }
}

/// A board that may or may not be in memory
enum ActiveState {
    Loaded(LoadedState),
    Unloaded,
}

struct BoardRef {
    file: BoardFileHandle,
    state: ActiveState,
}

/// Maintains a table of boards and fetches handles as requested
pub struct BoardManager {
    path: &'static Path,
    boards: AsyncHashMap<String, BoardRef>,
}

impl BoardManager {
    /// Create a new manager
    pub fn new(path: &'static Path) -> Self {
        let boards = AsyncHashMap::new();

        for (name, handle) in BoardFileHandle::get_boards(path).unwrap() {
            let _ = boards.insert(
                name,
                BoardRef {
                    file: handle,
                    state: ActiveState::Unloaded,
                },
            );
        }
        Self { boards, path }
    }

    /// Starts the requested board (if available) and returns a handle
    pub async fn load_board(&self, board_name: String) -> BoardHandle {
        let mut entry = self
            .boards
            .entry_async(board_name.clone())
            .await
            .or_insert_with(|| BoardRef {
                file: BoardFileHandle::create_new(self.path, &board_name),
                state: ActiveState::Unloaded,
            });

        let board = entry.get_mut();
        match &mut board.state {
            ActiveState::Loaded(state) => state.get_or_refresh(),
            ActiveState::Unloaded => {
                debug!("Trying to load a new board");
                let canvas = board
                    .file
                    .load_canvas()
                    .await
                    .unwrap_or_else(|_| ActiveCanvas::new_empty());
                let canvas = Arc::new(canvas);

                let handle = from_canvas(canvas.clone(), BOARD_TASKS);

                let state = LoadedState {
                    handle: handle.downgrade(),
                    canvas,
                };
                board.state = ActiveState::Loaded(state);

                handle
            }
        }
    }

    /// Flush all boards to disk
    pub async fn autosave(&self) {
        async {
            let mut current_entry = self.boards.first_entry_async().await?;

            loop {
                let board = current_entry.get_mut();

                if let ActiveState::Loaded(state) = &board.state {
                    let _ = board.file.save_canvas(&state.canvas).await;

                    trace!("Autosaved board {}", current_entry.key());
                }
                current_entry = current_entry.next_async().await?;
            }

            // needed for type inference
            #[allow(unreachable_code)]
            None::<()>
        }
        .await;
    }
}
