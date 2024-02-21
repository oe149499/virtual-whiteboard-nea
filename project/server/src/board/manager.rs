use std::{path::Path, sync::Arc};

use futures::Future;
use log::{debug, info, trace, warn};
use scc::HashMap as AsyncHashMap;

use tokio::sync::oneshot;

use crate::{canvas::ActiveCanvas, GlobalRes};

use super::{
    active::from_canvas,
    file::{get_boards, BoardFileHandle},
    BoardHandle, WeakHandle,
};

static BOARD_TASKS: usize = 4;

enum _BoardRef {
    Active(BoardHandle),
    Inactive,
}

struct LoadedState {
    handle: WeakHandle,
    canvas: Arc<ActiveCanvas>,
}

impl LoadedState {
    async fn get_or_refresh(&mut self) -> BoardHandle {
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
    pub fn new() -> Self {
        todo!()
    }

    /// Create a new manager for use during testing (no loading for now)
    pub fn new_debug(path: &Path) -> Self {
        // let debug_handle = debug_board();
        let boards = AsyncHashMap::new();

        let debug_board = BoardRef {
            file: BoardFileHandle::from_path("test-boards/debug.json".into()),
            state: ActiveState::Unloaded,
        };

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

        // boards
        //     .insert("test".to_string(), debug_board)
        //     .unwrap_or_else(|_| {
        //         warn!("Failed to insert debug board");
        //     });
        Self { boards }
    }

    /// Starts the requested board (if available) and returns a handle
    pub async fn load_board(&self, board_name: String) -> Option<BoardHandle> {
        if let Some(mut board) = self.boards.get_async(&board_name).await {
            let board = board.get_mut();
            match &mut board.state {
                ActiveState::Loaded(state) => Some(state.get_or_refresh().await),
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

#[cfg(test)]
mod test {
    use crate::{board::file::BoardFileHandle, canvas::ActiveCanvas, GlobalResources};

    use super::{BoardManager, BoardRef};

    fn assert_send<T: Send>() {}
    fn assert_sync<T: Sync>() {}

    #[test]
    fn assertions() {
        assert_send::<BoardFileHandle>();
        assert_send::<BoardRef>();
        assert_send::<ActiveCanvas>();
        assert_send::<BoardManager>();
        assert_sync::<GlobalResources>();
    }
}
