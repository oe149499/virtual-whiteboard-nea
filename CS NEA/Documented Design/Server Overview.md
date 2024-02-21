The server-side code operates on a coroutine-based event driven system, largely powered by the following constructs:
- Concurrent Hash Map, from `scc`
	- Implements a hash table able to insert and fetch items without locking the table as a whole, allowing the system to scale better on multi-threaded systems
- Multi-producer channels
	- Used in two forms: `mpsc` (Multi-producer single-consumer, from `tokio`) and `mpmc` (Multi-producer multi-consumer, from `async_channel`)
	- `mpsc` channels are used for relaying messages to clients to be stored
	- `mpmc` channels are used for sending messages to the board so that multiple tasks can process messages in parallel
- Read-Write Locks, from `tokio`
	- These are used when a structure needs to be completely owned to be mutated
	- Any number of read-only references to the wrapped value can be held, but writing requires exclusive access
	- Used in this project to wrap sets of IDs since `scc`'s maps don't have a good mechanism for iterating over them

Serving pages and communicating with clients is done through Warp, a lightweight implementation of an HTTP server
- Warp operates though "filters", patterns that match requests and can generate a reply
- Filters can be chained and composed to produce the final application, enabling different subsystems to each produce filters which add together to produce an application
# Modules
- `lib` - top-level code including composition of filters and shared object declarations
- `upload` - filters for storing and serving media files
- `client` - filters for establishing a connection between client and server
- `message` - declaration of structures which are sent to and from clients
	- Split across several sub-modules for different sections of the protocol
- `canvas` - declaration of structures relating to the canvas itself
	- `items` - Item type declarations
	- `active` - wrapper around the tables used to store a board
- `board` - implementation of whiteboards
	- `file` - disk format and saving/loading boards
	- `manager` - keeping track of active boards and loading/saving as necessary
	- `active` - processing messages and actually maintaining a board
		- Several sub-modules for implementation of different components of this
# Compilation targets
The project has two different compilation outputs:
- `codegen` - building TypeScript declaration files
	- Collects types and outputs them to a configurable location
- `main` - running a server
	- Handles command-line arguments and initialising the server