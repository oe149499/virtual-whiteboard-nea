use std::{path::Path, sync::Arc};

use log::{debug, trace};
use scc::HashMap as AsyncHashMap;

use crate::canvas::ActiveCanvas;

use super::{
    active::from_canvas,
    file::{get_boards, BoardFileHandle},
    BoardHandle, WeakHandle,
};

static BOARD_TASKS: usize = 4;

struct LoadedState {
    handle: WeakHandle,
    canvas: Arc<ActiveCanvas>,
}

impl LoadedState {
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
    boards: AsyncHashMap<String, BoardRef>,
}

impl BoardManager {
    /// Create a new manager
    pub fn new(path: &Path) -> Self {
        let boards = AsyncHashMap::new();
        
        for (name, handle) in get_boards(path).unwrap() {
            debug!("name: {}", &name);
            boards
                .insert(
                    name,
                    BoardRef {
                        file: handle,
                        state: ActiveState::Unloaded,
                    },
                )
                .map_err(|(name, _)| name)
                .unwrap();
        }
        Self { boards }
    }

    /// Starts the requested board (if available) and returns a handle
    pub async fn load_board(&self, board_name: String) -> Option<BoardHandle> {
        if let Some(mut board) = self.boards.get_async(&board_name).await {
            let board = board.get_mut();
            match &mut board.state {
                ActiveState::Loaded(state) => Some(state.get_or_refresh()),
                ActiveState::Unloaded => {
                    debug!("Trying to load a new board");
                    let canvas = board.file.load_canvas().await.ok()?;
                    let canvas = Arc::new(canvas);

                    let handle = from_canvas(canvas.clone(), BOARD_TASKS);

                    let state = LoadedState {
                        handle: handle.downgrade(),
                        canvas,
                    };
                    board.state = ActiveState::Loaded(state);

                    Some(handle)
                }
            }
        } else {
            None
        }
    }

    pub async fn autosave(&self) {
        let fut = async {
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
        };
        fut.await;
    }
}
