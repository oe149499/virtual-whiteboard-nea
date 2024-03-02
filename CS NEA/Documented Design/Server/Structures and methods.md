# The canvas
The canvas is tracked using two datastructures:
- A read-write locked set of ItemIDs which can be sequentially iterated over
- A concurrent map from ItemIDs to Items which enables parallel access but cannot be iterated over

Additionally, an atomic counter is used to generate new IDs for every item

Additionally, the ItemRef struct holds a locked entry and dereferences to the held item, allowing items to be retrieved and edited in-place

## module crate::canvas::active
ItemRef\<'a>

| Field | Type |
| ---- | ---- |
| 0 | OccupiedEntry\<'a, ItemID, Item><br>(locked reference to an ItemID:Item HashMap entry valid for 'a) |
| 1 | &'a CounterU64<br>(reference to an atomic U64 valid for 'a) |

ActiveCanvas

| Field | Type |
| ---- | ---- |
| next_id | AtomicU32 |
| item_ids | RwLock\<BTreeSet\<ItemID>> |
| items | scc::HashMap\<ItemID, Item> |
| edit_count | CounterU64 |


|  | Name | Receiver | Parameters | Return |
| ---- | ---- | ---- | ---- | ---- |
| pub | new_empty |  |  | Self |
|  | get_id | &self |  | ItemID |
| pub async | get_ref | &self | ItemID | Option\<ItemRef> |
| pub async | get_item | &self | ItemID | Option\<Item> |
| pub async | add_item | &self | Item | ItemID |
| pub | add_item_owned | &mut self | Item | ItemID |
| pub async | scan_items | &self | impl FnMut(ItemID, &Item)<br>(function taking an ItemID and a reference to an item which can be called from an exclusive reference) | () |
| pub async | get_item_ids | &self |  | Vec\<ItemID> |
| pub | get_item_ids_sync | &self |  | Result\<Vec\<ItemID>,()> |

# Communicating with clients
#TODO
## module crate::client
pub MessagePayload 

| Field | Type |
| ----- | ---- |
| 0      | Vec\<u8>     |

ClientMessage

| Variant | Fields |
| ------- | ------ |
| Payload        | (Vec\<u8>)       |

ClientHandle

| Field | Type |
| ----- | ---- |
| message_pipe      | UnboundedSender\<ClientMessage>     |

|  | Name | Receiver | Parameters | Return |
| ---- | ---- | ---- | ---- | ---- |
|  | new |  |  | (Self, UnboundedReceiver\<ClientMessage>) |
|  | send | &self | ClientMessage | () |
|  | send_data | &self | Vec\<u8> | () |
| pub | send_message | &self | MsgSend | () |
| pub | send_payload | &self | &MessagePayload | () |

Session

| Field | Type |
| ---- | ---- |
| client_id | ClientID |
| handle | BoardHandle |

| Name | Receiver | Parameters | Return |
| ---- | ---- | ---- | ---- |
| connect | &self | ClientHandle |  |
| disconnect | &self |  |  |
| message | &self | MsgRecv |  |

pub SessionRegistry - alias of RwLock\<HashMap\<SessionID, Session>>

Module-level functions

|  | Name | Parameters | Return |
| ---- | ---- | ---- | ---- |
| pub | create_client_filter | GlobalRes | BoxedFilter |
| async | handle_session | Session, WebSocket | () |
# Interface with board
## module crate::board
BoardMessage

| Variant | Fields |
| ---- | ---- |
| ClientMessage | ClientID, MsgRecv |
| SessionRequest | ClientInfo, oneshot::Sender\<Result\<ConnectionInfo, Error>> |
| ClientConnected | ClientID, ClientHandle |
| ClientDisconnected | ClientID |

pub BoardHandle

| Field | Type |
| ----- | ---- |
| message_pipe      | async_channel::Sender\<BoardMessage>     |

|  | Name | Receiver | Parameters | Return |
| ---- | ---- | ---- | ---- | ---- |
|  | send_msg | &self | BoardMessage | () |
| pub async | create_session | &self | ClientInfo | Result\<ConnectionInfo, Error> |
| pub | client_msg | &self | ClientID, MsgRecv | () |
| pub | client_connected | &self | ClientID, ClientHandle | () |
| pub | client_disconnected | &self | ClientID | () |
|  | downgrade | &self |  | WeakHandle |

WeakHandle

| Field | Type |
| ----- | ---- |
| 0      | async_channel::WeakSender\<BoardMessage>     |

| Name | Receiver | Parameters | Return |
| ---- | ---- | ---- | ---- |
| upgrade | &self |  | Option\<BoardHandle> |

# Saving and loading
## module crate::board::file

BoardFileAttrs

| Field | Type |
| ----- | ---- |
| readonly      | bool     |

BoardFile

| Field | Type |
| ---- | ---- |
| items | Vec\<Item> |
| (flattened)<br>attrs | BoardFileAttrs |

pub BoardFileHandle

| Field | Type |
| ---- | ---- |
| file_path | PathBuf |
| temp_path | PathBuf |
| attrs | BoardFileAttrs |

|  | Name | Receiver | Parameters | Return |
| ---- | ---- | ---- | ---- | ---- |
| pub | from_path |  | PathBuf | Self |
| pub async | load_canvas | &mut self |  | io::Result\<ActiveCanvas> |
| pub async | save_canvas | &mut self | &ActiveCanvas | io::Result\<()> |

Module-level methods

|  | Name | Parameters | Return |
| ---- | ---- | ---- | ---- |
|  | try_get_board | DirEntry | Option\<(String, BoardFileHandle)> |
| pub | get_boards | &Path | io::Result\<Vec\<(String, BoardFileHandle)>> |

# Managing boards
## module crate::board::manager
LoadedState

| Field | Type |
| ---- | ---- |
| handle | WeakHandle |
| canvas | Arc\<ActiveCanvas> |

|  | Name | Receiver | Parameters | Return |
| ---- | ---- | ---- | ---- | ---- |
| async | get_or_refresh | &mut self |  | BoardHandle |

ActiveState

| Variant | Fields |
| ---- | ---- |
| Loaded | LoadedState |
| Unloaded |  |

BoardRef

| Field | Type |
| ---- | ---- |
| file | BoardFileHandle |
| state | ActiveState |

pub BoardManager

| Field | Type |
| ----- | ---- |
| boards      | scc::HashMap\<String, BoardRef>     |

|  | Name | Receiver | Parameters | Return |
| ---- | ---- | ---- | ---- | ---- |
| pub | new |  | &Path | Self |
| pub async | load_board | &self | String | Option\<BoardHandle> |
| pub async | autosave | &self |  |  |

# Active Boards
## module crate::board::active
ActivePath

| Field | Type |
| ---- | ---- |
| client | ClientID |
| nodes | Vec\<SplineNode> |
| listeners | Vec\<IterateHandle\<GetActivePath>> |
| stroke | Stroke |
| last_flush | Instant |

SelectionState

| Field | Type |
| ---- | ---- |
| items | BTreeMap\<ItemID, Transform> |
| own_transform | Transform |

ClientState

| Field | Type |
| ---- | ---- |
| info | ClientInfo |
| handle | Option\<ClientHandle> |
| active_paths | Vec\<PathID> |
| selection | SelectionState |

Board

| Field | Type |
| ---- | ---- |
| client_ids | RwLock\<BTreeSet\<ClientID>> |
| clients | scc::HashMap\<ClientID, ClientState> |
| canvas | Arc\<ActiveCanvas> |
| selected_items | scc::HashMap\<ItemID, Option\<ClientID>> |
| active_paths | scc::HashMap\<PathID, ActivePath> |

|  | Name | Receiver | Parameters | Return |
| ---- | ---- | ---- | ---- | ---- |
|  | new_from_canvas |  | Arc\<ActiveCanvas> | Self |
|  | launch | self | tasks: usize | BoardHandle |
| async | handle_message | &self | BoardMessage | () |
| async | handle_client_message | &self | ClientID, MsgRecv | () |

Module-level functions

|  | Name | Parameters | Return |
| ---- | ---- | ---- | ---- |
| pub | from_canvas | Arc\<ActiveCanvas>, tasks: usize | BoardHandle |
## module crate::board::active::active_helpers
pub TakeResult

| Variant |
| ---- |
| Successful |
| NonExistent |
| Occupied |
| AlreadyOwned |

impl Board

|  | Name | Receiver | Parameters | Return |
| ---- | ---- | ---- | ---- | ---- |
| pub<span>&nbsp;</span>async | check_owned | &self | &ClientID, &Handle, ItemID | bool |
| pub async | take_item | &self | &ClientID, &Handle, ItemID | TakeResult |
| pub async | get_client | &self | &ClientID | OccupiedEntry\<ClientID, ClientState> |
| pub async | get_handle | &self | &ClientID | Option\<ClientHandle> |
| pub async | send_notify_c | &self | NotifyCType | () |

impl ClientState

|  | Name | Receiver | Parameters | Return |
| ---- | ---- | ---- | ---- | ---- |
| pub | try_send | &self | MsgSend | () |
| pub | try_send_payload | &self | &MessagePayload | () |