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
	- Interpreting command-line arguments and composing the Warp server
	- `message` - types for communicating with clients and internally
	- `client` - setting up a WebSocket filter and handling connections (inc. parsing messages)
	- `board` - managing boards
		- `file` - reading and writing from files
		- `active` - working with an active board in memory and dealing with client requests
		- `manager` - maintaining a list of boards and loading/finding them when needed
	- `upload` - setting up the media upload endpoint
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
		- `typescript/` - Typescript files and JS output
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
	- Export?
		- probably would be mostly client-side as client will have SVG code, but a bulk download of board data might me useful
- Static files
	- HTML, CSS, images, etc.
	- Might have extra path for root HTML file but probably under a `/static` path which maps to a filesystem directory
- JS/TS
	- Probably under `/script` or something similar
	- Include original TS files so source mapping can be used during debugging
	- Include generated files under `/script/gen`
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
	- `api/` - dynamic content and interacting with the server
		- `board/<name>/ (websocket)` - Main API route for interacting with the board
		- `upload/` - Uploading media files