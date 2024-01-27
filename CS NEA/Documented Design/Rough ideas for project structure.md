# Rust code
## Components
- Command-line arguments and initialisation
- HTTP server setup
- File uploads
- Client handler and message dispatcher
- Canvas items
	- Type definitions for items
- Message types
- Boards
	- Table of active boards
	- Active boards
	- Saving and loading of files
- Code generation and setup
## Potential layout (Rust module structure)
- `crate` - top level
	- `main.rs` - primary executable
	- `lib.rs` - common code
	- `codegen.rs` - separate build target for generating TS code
	- Interpreting command-line arguments and composing the Warp server
	- `message` - types for communicating with clients and internally
	- `client` - setting up a WebSocket filter and handling connections (inc. parsing messages)
	- `board` - managing boards
		- `file` - reading and writing from files
		- `active` - working with an active board in memory and dealing with client requests
		- `manager` - maintaining a list of boards and loading/finding them when needed
	- `upload` - setting up the media upload endpoint
	- `tags` - working with tags
	- `canvas` - canvas item types
# Source files
## Components
- Rust source
- TS files
- Static HTML/CSS
- Static images
## Potential layout
- `/` - Project root
	- `server/` - rust root
	- `client/` - client code
		- `static/` - hand-written files, would most likely map directly to `/static` path on server
			- `css/` - CSS files
			- `img/` - Misc. image files
			- `icon/` - Icons, probably with a more rigid name system
		- `typescript/` - Typescript files
			- `out/` - JS output
# Stored data
## Components
- Media files
	- Upload to directory specified at command line
		- per-board or global? probably global.
		- Need unique identifier to prevent conflicts
		- format: 
			- `/123456/<originalname>.png`
			- `/123456.png`
			- `/123456_<originalname>.png`
- Board
	- Probably store in JSON, same as transfer format albeit different root structure
		- Could have small metadata file and larger data file to avoid keeping all data in memory
			- Metadata could all be grouped into one file
	- Could experiment with chunked files for large projects but probably not necessary for a-level
# Website
## Components
- WebSocket API
	- probably own specific path e.g. `ws:///api/board/<name>/`
- Other misc. APIs
	- probably `http:///api/foo/bar`
	- File upload
	- Tags - `http:///api/tag/...`
		- querying tag types
		- modifying tags
		- Archiving tags
	- Export?
		- probably would be mostly client-side as client will have SVG code, but a bulk download of board data might me useful
- Static files
	- HTML, CSS, images, etc.
	- Might have extra path for root HTML file but probably under a `/static` path which maps to a filesystem directory
- JS/TS
	- Probably under `/script` or something similar
	- Include original TS files so source mapping can be used during debugging
	- Include generated files under `/script/gen`
- Media files
	- Under `media/`?
## Potential layout
`
- `/`
	- `index.html` - serve main HTML page, alias of `/static/index.html`
	- `static/` - serve static files
		- `css/` - CSS files
		- `icon/` - Icons
		- `img/` - misc. images
	- `script/` - serve scripts
		- `gen/` - source-generated script files
		- `source/` - original TS files for debugging
	- `api/` - dynamic content and interacting with the server
		- `board/<name>/ (POST)` - create session ID
		- `session/<name>/ (websocket)` - Main API route for interacting with the board
		- `tag/` - tags
			- `create/ (POST)`
				- Parameters (form data)
					- Short name (e.g. an emoji)
					- Long name (e.g. full description, can be used in search)
					- Type
			- `get/`
				- `all/`
				- `active/`
				- `archived/`
				- `<id>/`
			- `alter/`
				- `modify/ (POST)` - change some information
				- `archive/ (POST)` - Archive the tag, preventing creation of new instances but not disabling old ones
			- `query/`
		- `upload/ (POST)` - Uploading media files
	- `media/<ID>/filename` - user-uploaded media
# Board representation
- ID-Object table
	- Board-unique IDs with stored counter
	- Object representation - Enumeration
		- Null()
		- BasicShape(Transform, Fill, Stroke, Type)
		- Line(point, point, Stroke)
		- Polygon(Stroke, Fill, point\[\])
		- Path(Transform, Stroke, ???)
		- Image(url, description, Transform)
		- Text(Transform, font size, font style, text)
		- Link(url, description, Transform)
- Selection
	- Client ID (globally unique but preserved across reconnects)
	- List of object IDS
	- Selection origin
	- Selection transform
# WS API
- Method
	- takes parameters and unique call ID
	- response is sent with same ID
	- Response message consists only of status unless specified otherwise
- Iterator method?
	- Method responses sent in parts
	- Sequence number and end packet
- Notify-S
	- Alert server of information but no response expected
- Notify-C
	- Information sent to client but no response expected
- Failure
	- Sent as response when any of the following is the case:
		- Malformed message
		- Server error
	- Formatted as unspecified JSON
	- Should be handled as an exception
## Components
- Connecting to boards
	- End Session - method
		- No return but should wait until completion
	- Client Joined - notify-c
		- Client ID, info
	- Client Connected - notify-c
		- Client ID
	- Client Disconnected - notify-c
		- Client ID
	- Client Exited - notify-c
		- Client ID
- Selection
	- Add to selection - method
		- Parameters - Item IDs
	- Remove from selection - method
		- Parameters - IDs, final transform(s)
	- Move selection - method
		- relative transform
	- Items Deselected - notify-c
		- Client ID, IDs, final transform
	- Items Selected - notify-c
		- Client ID, IDs
	- Selection Moved - notify-c
		- Client ID, new selection transform
- Item Editing
	- Edit Items - method
		- Item IDs, Item Changes
	- Edit Item - method
		- Item ID, Item 
	- Delete Items - method
		- Item IDs
	- Items edited - notify-c
		- Item IDs, Item Changes
	- Item edited - notify-c
		- Item ID, Item
	- Items Deleted - notify-c
		- Item IDs
- Item Creation
	- Create Item - method
		- Item info
		- Response - ID
	- Item Created - notify-c
		- Item info, Item ID, Client ID
	- Begin Path - method
	- Path Started - notify-c
		- Client ID
	- Continue Path - method
		- ???
	- Close Path - method
		- Computed path data, immediate transform
- Requesting data
	- Get All IDs - method
		- Response - list of Item IDs
	- Get Partial Items - iterate
		- List of Item IDs
		- Response - partial information (large fields excluded)
	- Get Full Items - iterate
		- List of Item IDs
		- Response - full item information
	- Get Client Information - method
		- Response - ??? (information about all clients)
	- Get Active Path - iterate
		- Client ID
		- Response - path data, sent as processed
## Types
```typescript
enum ErrorCode {
	NotAvailable, // The client requested a resource which is occupied or does not exist
}

type Ok<T> = { ok: T };
type Err<T> = { err: T, info?: any };
type Result<TOk = null, TErr = ErrorCode> = Ok<TOk> | Err<TErr>;

type ClientInfo = {
	name: string,
};

type SessionID = number;

type ClientID = number;

type ItemID = number;

type Point = {
	x: number,
	y: number,
}

type Color = string;

type Stroke = {
	width: number,
	color: Color,
}

type Angle = number;

type Transform = {
	origin: Point,
	rotation: Angle,
	scaleX: number,
	scaleY: number,
}

type PartialItem = {
	transform?: transform,
	
}

enum ItemType {
	Rectangle: "rect",
	Ellipse: "circle",
	Line: "line",
	Polygon: "polygon",
	Path: "path",
	Image: "image",
	Text: "text",
	Link: "link"
}

type HasTransform = { transform: Transform };

type HasStroke = { stroke: Stroke };

type HasFill = { fill: Color };

type PathData = "???"

type RectangleItem = HasTransform & HasStroke & HasFill & {
	type: ItemType.Rectangle,
}

type EllipseItem = HasTransform & HasStroke & HasFill & {
	type: ItemType.Ellipse,
}

type LineItem = HasStroke & {
	type: ItemType.Line,
	start: Point,
	end: Point,
}

type PolygonItem = HasStroke & HasFill & {
	type: ItemType.Polygon,
	points: Point[],
}

type PathItem = HasStroke & HasTransform & {
	type: ItemType.Path,
	path: "???",
}

type ImageItem = HasTransform & {
	type: ItemType.Image,
	url: string,
	description: string,
}

type TextItem = HasTransform & {
	type: ItemType.Text,
	text: string,
}

type LinkItem = HasTransform & {
	type: ItemType.Link,
	text: string,
	url: string,
}
```
## Exact Protocol
```typescript
// Method syntax:
async function method(...): ReturnType;

// Notify-S syntax:
async function notifyS(...);

// Notify-C syntax
async function onNotifyC(...);

// Iterate
async function * iterate(...): AsyncIterable<ReturnType>;

// # Connection
async function endSession();
async function onClientJoined(id: ClientID, info: ClientInfo);
async function onClientConnected(id: ClientID);
async function onClientDisconnected(id: ClientID);
async function onClientExited(id: ClientID);

// # Selection
// Returns a result for each individual item
async function selectionAddItems(items: ItemID[]): Result[];
type ItemsDeselected = Map<ItemID, Transform | Point[]>;
// NOTE: Considerations should be taken to ensure that data is never destroyed in this procedure
async function selectionRemoveItems(items: ItemsDeselected): Result;
async function selectionMove(newTransform: Transform);

async function onSelectionItemsAdded(client: ClientID, items: ItemID[]);
async function onSelectionItemsRemoved(client: ClientID, items: ItemsDeselected);
async function onSelectionMoved(client: ClientID, transform: Transform);

// # Item Editing
type ItemChanges = Optional<HasStroke & HasFill>;

async function editBatchItems(items: ItemID[], changes: ItemChanges): Result[];
// NOTES:
//   - Consider whether items could be allowed to be changed into other types
//   - "Big" fields could be exluded with a specific coded value e.g. non-printable char, NaN
async function editSingleItem(id: ItemID, item: Item): Result;
async function deleteItems(ids: ItemID[]): Result;

async function onBatchItemsEdited(items: ItemID[], changes: ItemChanges);
// NOTE: same logic as `editSingleItem`
async function onSingleItemEdited(id: ItemID, item: Item);
async function onItemsDeleted(ids: ItemID[]);

// # Item Creation
async function createItem(item: Item): Result<ItemID>;
async function beginPath(stroke: Stroke);
async function continuePath(data: "???");
async function closePath(data: "???"): Result<ItemID>;

async function onItemCreated(id: ItemID, item: Item);
async function onPathStarted(client: ClientID, stroke: Stroke);

// # Data fetching
async function getAllItemIDs(): Result<ItemID[]>
async function * getPartialItems(ids: ItemID[]): AsyncIterator<Result<Item>>;
async function * getFullItems(ids: ItemID[]): AsyncIterator<Result<Item>>;
async function getAllClientInfo(): Result<Map<ClientID, ClientInfo>>;
async function * getActivePath(client: ClientID): AsyncIterator<"???">;
```
## Wire Format
- JSON-encoded data e.g.
```json
[
	{
		"protocol": "Method",
		"id": 12345,
		"name": "Ping",
		"param": "arg",
		"param2":, "arg2",
		// ...
	},
	{
		"protocol": "Response",
		"id": 12345,
		"value": "Pong",
		// ...
	},
	{
		"protocol": "Notify-C",
		"name": "Hello",
		"param": "arg",
		// ...
	},
	{
		"protocol": "Notify-S",
		"name": "Hi",
		"param": "arg",
		// ...
	},
	{
		"protocol": "Iterate",
		"name": "Count",
		"id": 27,
		"countTo": 4,
	},
	{
		"protocol": "Response-Part",
		"id": 27,
		"complete": false,
		"part": 0,
		"items": [0, 1],
	},
	{
		"protocol": "Response-Part",
		"id": 27,
		"complete": false,
		"part": 1,
		"items": [2, 3],
	},
	{
		"protocol": "Response-Part",
		"id": 27,
		"complete": true,
		"part": 2,
		"items": [4],
	}
] // Multiple messages can be bundled together
```
