use log::warn;
use scc::HashMap;

use super::{BoardHandle, active::debug_board};

enum BoardRef {
	Active(BoardHandle),
	Inactive,
}

/// Maintains a table of boards and fetches handles as requested
pub struct BoardManager {
	boards: HashMap<String, BoardRef>,
}

impl BoardManager {
	pub fn new() -> Self {
		todo!()
	}

	/// Create a new manager for use during testing (no loading for now)
	pub fn new_debug() -> Self {
		let debug_handle = debug_board();
		let boards = HashMap::new();
		boards.insert("test".to_string(), BoardRef::Active(debug_handle)).unwrap_or_else(|_| {
			warn!("Failed to insert debug board");
		});
		Self {
			boards
		}
	}

	/// Starts the requested board (if available) and returns a handle
	pub async fn load_board(&self, board_name: String) -> Option<BoardHandle> {
		if let Some(board) = self.boards.get_async(&board_name).await {
			match board.get() {
				BoardRef::Active(handle) => return Some(handle.clone()),
				_ => {
					todo!()
				}
			}
		}
		None
	}
}