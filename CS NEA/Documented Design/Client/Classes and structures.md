# The property system
In several places the application needs to display and store attributes of things, and so to avoid repetition this is described in terms of properties, which are a representation of a data structure along with how it should be displayed.

The first component of this is a `PropKey`, which is a unique identifier for a piece of data stored by a property, along with other information such as a default value and/or data validators.

As a convenience feature, a `CompositeKey` allows bundling the components of a composite data structure into a function which composes the values returned by sub-keys into a single output

The second component is `PropertySchema`, which describes a property with its type, key, and other attributes such as display name and constraints

Finally, the abstract type `PropertyStore` defines the interface for getting and setting properties by key

Alongside this is a basic implementation of a property store, `SingletonPropertyStore`, which simply stores properties in a key-value map

To make properties easier to work with, two systems are implemented:
- Property templates, which build the keys and schema for common properties such as stroke or points
- property builders, which accumulate multiple sets of keys and schemas in a single object to enable properties to be more concisely defined
## Class tables
(note that in this section "value" refers to the value type corresponding to a key)
PropKey:

| Field | Type |
| ---- | ---- |
| validator | (value) => bool |
| defaultVal? | (value) |
| type | string |
CompositeKey\<T>

| Field | Type |
| ----- | ---- |
| extractor      | (property getter) => T     |
PropertyStore

| Method | Type |
| ---- | ---- |
| read(PropKey) | value |
| read\<T>(CompositeKey\<T>) | T |
| store(PropKey, value) | bool |
| abstract get(PropKey) | value \| NoValue |
| abstract set(PropKey, value) | void |

# State
The state mechanism prevents manual updates to parts of the application by creating a wrapper with two fundamental operations:
- Read the current value
- Attach a callback to be notified when the value changes

This is then used to implement other operations such as:
- Create a derived state from a function mapping the current value to a new one
- Combining multiple states together in order to create a state derived from multiple inputs

The core of this is the abstract `State<T>` class, which implements the basic operations and has operations for creating derived instances

The other key component is `MutableState<T>`, which is used to provide a source of state and includes several means of modifying the contained value

Most of the other subclasses of `State` wrap one or more source states and produce a new value from them.

## Class tables
The following shorthand applies to this section:
- action(T) is a function taking a readonly value of T and returning nothing
- map(T, U) is a function taking a readonly value of T and returning a value of U

State\<T>

| Field            | Type                               |
| ---------------- | ---------------------------------- |
| private watchers | Map\<number, action(T)> |
| private weakWatchers                 | Map\<number, WeakRef\<action(T)>>                                   |

| Method | Parameters | Return Type | Notes |
| ---- | ---- | ---- | ---- |
| get |  | readonly T |  |
| getSnapshot |  | T | returns a clone of the held value |
| protected update | T | void | Updates the held value and runs update callbacks |
| watch | action(T) | WatchHandle |  |
| watchWeak | action(T) | WatchHandle |  |
| watchOn | object, action(T) | void | Will run the callback for as long as the object is alive |
| private removeWatcher, private removeWeak | number | void |  |
| derived\<U> | map(T, U) | State\<U> |  |
| derivedI | string, ... | State | Creates a derived state from calling an instance method of the held value with the specified parameters |
| derivedT |  | State | For tuple states, like derived but the callback receives each element of the tuple as a separate parameter |
| flatten |  | State | Flattens a state of a state into a single state |
| inspect\<U> | map(T, U) | U | calls the function on the contained value and returns its result |
| with | ...state | State | Collects a tuple of states together and returns a state of a tuple |
| debug | Logger, string? | this | Watches the state with the provided logger for debugging |

MutableState\<T>

| Method | Parameters | Return | Notes |
| ---- | ---- | ---- | ---- |
| set | T | void |  |
| updateBy | T => T | void | Shorthand for setting a new value based on the old one |
| mutate | T => void | void | Allows the held value to be mutated in-place |
| derivedM\<U> | MutableTransformer\<T, U> | MutableState\<U> | Creates a new mutable state from a two-way mapping |
| extract\<U> | (field name) \| MutableExtractor\<T, U> | MutableState\<U> | Creates a new mutable state extracting a component of the wrapped value, with a shorthand for a field of the value |
# Channels
A channel consists of a sender and a receiver and is used for asynchronous data streams

## Class table
Channel\<T>

| Field           | Type                 |
| --------------- | -------------------- |
| private queue   | T\[]                 |
| private handles | PromiseHandle\<T>\[] |
| private closed                | bool                     |

| Method | Parameters | Type |
| ---- | ---- | ---- |
| private handlePromises |  | void |
| public push | T | void |
| private pop |  | Promise\<T> |
| public close |  | void |
| internal getIter |  | AsyncIterator\<T> |
# Communication with the server
Communication is split into three components:

RawClient, which handles the WebSocket communication and protocol

HttpApi, which is a collection of static methods for the other server APIs

SessionClient, which handles the connection logic and provides an abstract interface to the server protocol


In addition, the IterateReceiver helper type handles decoding multi-part responses from the server

## Class tables
IterateReceiver

| Field | Type |
| ---- | ---- |
| private futureParts | Record\<number, item\[]> |
| private nextPart | number |
| private lastPart | number |
| finished | bool |

HttpApi

| Name | Type | Description |
| ---- | ---- | ---- |
| openSession(string, ClientInfo) | Promise\<Result\<ConnectionInfo>> | Calls the HTTP api to open a new session on a board |
| uploadFile(File) | Promise\<URL> | Uploads a file to the server |
| startTime | Promise\<number> | The UNIX timestamp when the server was launched |

RawClient

| Field (private) | Type |
| ---- | ---- |
| callId | number |
| socket | WebSocket |
| calls | Record\<number, CallRecord> |
| notifyCHandlers | callback for each type of Notify-C |
| iterateReceivers | Record\<number, IterateReceiver> |
| messageQueue | Channel\<string> |
| messageStream | AsyncIter\<string> |
| url | URL |

| Method | Parameters | Return | Notes |
| ---- | ---- | ---- | ---- |
| private bindSocket |  | void |  |
| private sendPayload | string | void |  |
| callMethod | name: string, args | Promise\<return type> |  |
| callIterate | name: string, args | AsyncIter\<item type\[]> |  |
| setNotifyHandler | name: string, callback: (notify args) => void | void |  |
| private handleMessageObject | MsgRecv | void |  |
| private onSocketOpen | Event | void |  |
| private onSocketError | Event | void |  |
| private onSocketMessage | MessageEvent | void |  |
| private onSocketClose | CloseEvent | void |  |

SessionClient

| Field | Type |
| ---- | ---- |
| private rawClient | RawClient |
| readonly socketUrl | URL |
| readonly boardName | string |
| private sessionCode | number |
| readonly clientID | number |
| readonly info | ClientInfo  |
# Tools
Tools can be divided into three categories:

- Instantaneous tools, which perform a single action when activated
	- The interface for this is a single `execute` method
- Mode tools, which stay active until deselected
	- This is represented by `bind` and `unbind` methods
- Action tools, which stay active until the user completes a single action
	- This is represented by a `bind` method which takes a callback, which in turn receives an `Action` object when the action starts
	- An `Action` contains two fields, a Promise for the completion of the action and a method to cancel it

Additionally, each tool can have a set of properties connected to it

To support this a set of abstract base classes are defined
- `ToolBase`, which adds a few helper properties for accessing parts of the board
- `InteractiveToolBase`, which builds on `ToolBase` to automatically build a gesture filter from optional virtual methods
- `ActionToolBase`, which builds on `InteractiveToolBase` to implement the action tool interface
- `ModeToolBase`, which similarly builds on `InteractiveToolBase`
- `InstantaneousToolBase`, which directly extends `ToolBase`

## Class Tables
Aliases

| Name | Type |
| ---- | ---- |
| OnBegin | (Action) => void |
| Action | { cancel(): void, completion: Promise\<void> } |

ToolBase

| Field (protected) | Type |
| ---- | ---- |
| board | Board |
| canvas | CanvasController |
| ctx | CanvasContext |

InteractiveToolBase

| Field | Type |
| ----- | ---- |
| gestureFilter      | FilterHandle     |

| Method | Parameters | Type |
| ---- | ---- | ---- |
| private makeFilter |  | FilterHandle |
| protected onDragGesture? | DragGestureState | void |
| protected onPressGesture? | PressGesture | void |
| protected onLongPressGesture? | LongPressGesture | void |

ActionToolBase

| Field | Type |
| ---- | ---- |
| private onBegin? | OnBegin |
| private completionResolve? | () => void |

| Method | Parameters | Type |
| ---- | ---- | ---- |
| bind | OnBegin | void |
| protected start |  | void |
| protected end |  | void |
| protected abstract cancel |  | void |

ModeToolBase

| Method | Parameters | Type |
| ------ | ---------- | ---- |
| bind   |            | void     |
| unbind       |            | void     |

InstantaneousToolBase

 | Method | Type |
 | ------ | ---- |
 | abstract execute       | void     |
# UI
The structure of the UI is based primarily around icons and panels:
- A `SimpleIcon` loads an SVG icon file and renders it as an image
- A `ToolIcon` wraps a `SimpleIcon` and connects it to a tool as well as showing whether it is selected
- A `VisibilityButton` also wraps a `SimpleIcon` and updates its display to reflect a panel's state
- A `PanelController` wraps an element and adds a `VisibilityButton` along with the logic to show/hide the contents

Finally, the `UIManager` wraps all of these and ties them together

## Class tables
Aliases

| Name             | Type           |
| ---------------- | -------------- |
| ToolIconCallback | (Tool) => void |
| PanelEvents                 | { cancel(): void }               |

SimpleIcon

| Field | Type |
| ----- | ---- |
| readonly element      | HTMLImageElement     |

ToolIcon

| Field | Type |
| ---- | ---- |
| private icon | SimpleIcon |
| readonly element | HTMLElement |
| private toolState | DeferredState\<ToolState> |
| readonly active | State\<boolean> |
| onselect? | ToolIconCallback |
| ondeselect? | ToolIconCallback |

VisibilityButton

| Field | Type |
| ---- | ---- |
| private container | HTMLDivElement |
| private icon | SimpleIcon |
| readonly openState | MutableState\<boolean> |
| readonly events | EventProvider\<PanelEvents> |

PanelController

| Field | Type |
| ---- | ---- |
| private visibility | VisibilityButton |
| readonly contents | HTMLElement |
| readonly openState | State\<boolean> |
| readonly events | MultiTargetDispatcher\<PanelEvents> |
| private containerElement | HTMLElement |

| Method | Type |
| ------ | ---- |
| private getContents       | HTMLElement     |

UIManager

| Field | Type |
| ---- | ---- |
| readonly containerElement | HTMLDivElement |
| readonly viewPanel | PanelController |
| readonly toolPanel | PanelController |
| readonly propertiesPanel | PanelController |
| readonly properties | PropertyEditor |
| private toolState | MutableState\<ToolState> |
| readonly toolState | State\<ToolState> |

| Method | Parameters | Type |
| ---- | ---- | ---- |
| addToolIcon | ToolIcon, "edit" \| "view" | void |
| private cancelTool |  | void |
| private onIconSelect | Tool | void |
| private onIconDeselect | Tool | void |
| private createPanel | string, State\<EnabledState>, ...string\[] | PanelController |

# Basic canvas structure and utilities
The canvas is laid out in SVG as follows:
```xml
<svg>
  <g class="scaled-root" transform="...">
    <!-- ... -->
  </g>
  <g class="unscaled-root">
    <!-- ... -->
  </g>
</svg>
```
The hierarchy is split into two parts:
- Scaled content, such as items, which should zoom uniformly with the canvas
- Unscaled content, such as UI, which should move to follow the board but not change in size

This structure is implemented by `CanvasContext`, which is the foundation of most SVG manipulation and provides a wide collection of helper methods

To group unscaled elements, `CanvasContext` has an inner class, `UnscaledHandle` that stores a group of elements and enables them to be removed together

Alongside this is a set of small helper types:
- `MatrixHelper` - maintains an SVG transformation from a state of a matrix
- `TranslateHelper` - similar but only does translation
- `TransformHelper` - works with Transform instances along with extra helper methods
- `StrokeHelper` and `FillHelper` - applies properties to an item, including static methods
- `CenterHelper` - wraps an element in a container that translates it to its centre
- `PathHelper` - builds a list of `SplineNodes` and concatenates them into an SVG path string

## Class tables
CoordinateMapping

| Field | Type |
| ---- | ---- |
| screenOrigin | Point |
| stretch | number |
| targetOffset | Point |

CanvasContext

| Field | Type |
| ---- | ---- |
| private svgroot | SVGSVGElement |
| private scaledRoot | SVGGElement |
| private unscaledRoot | SVGGElement |
| readonly coordMapping | State\<CoordinateMapping> |
| readonly cursorPosition | State\<Point> |
| private gestures | GestureHandler |

| Method | Parameters | Type |
| ---- | ---- | ---- |
| createGestureFilter | GestureLayer | FilterHandle |
| createElement | tag name string | corresponding SVGElement |
| createTransform | DOMMatrixReadOnly? | SVGTransform |
| createPoint | Point? | SVGPoint |
| createPointBy | State\<Point> | SVGPoint |
| createRect | Point, Point | SVGRect |
| createRootElement | tag name string | corresponding SVGElement |
| insertScaled | SVGElement | SVGElement |
| getUnscaledHandle |  | CanvasContext.UnscaledHandle |
| getUnscaledPos | State\<Point> | State\<Point> |
| createUnscaledElement | tag name string, State\<Point> | corresponding SVGElement |
| insertUnscaled | SVGElement, State\<Point> | SVGElement |
| translate | Point, CoordinateMapping? | Point |
|  |  |  |

CanvasContext.UnscaledHandle

| Field | Name |
| ----- | ---- |
| private elements      | Set\<SVGElement>     |

| Method | Parameters | Type |
| ---- | ---- | ---- |
| insert | SVGGraphicsElement, State\<Point> | SVGGraphicsElement |
| insertStatic | SVGGraphicsElement | SVGGraphicsElement |
| create | tag name string, State\<Point> | SVGGraphicsElement |
| getPoint | State\<Point> | SVGPoint |
| clear |  | void |

# Canvas Items
Rendering canvas items to the board is done through the `CanvasItem` abstract class, which provides an API for drawing and manipulating items, including editing and moving.

Since some items have many details in common, some additional abstract classes are defined:
- `StrokeItem` and `FillItem`, which automatically handle stroke and fill respectively
- `TransformMixin`, which wraps around any class deriving from `CanvasItem` to produce a new class which additionally handles transformations

The other key component is properties, so `ItemPropertyStore` is an implementation of `PropertyStore` which holds functions to extract and store keys in items of a specific type, and also references a set of currently selected items.

## Class Tables
CanvasItem

| Field | Type |
| ---- | ---- |
| readonly element | SVGGElement |
| protected abstract innerElement | SVGGraphicsElement |
| protected abstract item | Item |

| Method | Parameters | Type |
| ---- | ---- | ---- |
| update | Item | void |
| protected abstract updateItem | Item | void |
| static schemaFor | CanvasItem, ItemPropertyStore | PropertySchema\[] |
| protected getBounds |  | Bounds |
| testIntersection | Point | bool |
| abstract getLocationUpdate | DOMMatrix | LocationUpdate |
| abstract applyLocationUpdate | LocationUpdate | void |
| protected checkType | Item, string | void |

ItemPropertyStore

| Field | Type |
| ---- | ---- |
| private currentItems | ItemEntry\[] |
| private accessorTable | Mapping from item types to key-accessor table |

| Method | Parameters | Type |
| ---- | ---- | ---- |
| private getAccessor | ItemType, PropKey | ItemAcc |
| bindEntries | Iterable\<ItemEntry> | void |
| getter | ItemType, PropKey, (item) => value | void |
| setter | ItemType, PropKey, (item, value) => void | void |
# Gesture handling
To enable easy handling of user input, screen interaction is modelled as gestures such as a press or drag.

These are then processed by attempting to match them to filters, which include a test function to check if a gesture is in range, and handlers for one or more gesture types.

To enable more fine-grained control, filters are also divided into priority layers, where the highest-priority layers are checked first.

Filters can also be enabled and disabled freely, so something like a tool can build its filter once and pause it when not active

This system is implemented in terms of three types
- `GestureHandler`, which handles decoding pointer events and dispatching events
- The `FilterHandle` interface, which is the public API for manipulating filters
- The private `FilterImpl` class, which implements `FilterHandle` and communicates information to the `GestureHandler`

## Class tables
FilterHandle (all methods return the same instance they are called from)

| Method | Parameters |
| ---- | ---- |
| pause |  |
| resume |  |
| setTest | (Point) => bool |
| setMode | FilterMode |
| addHandler | GestureType, (Gesture) => void |
| removeHandler | GestureType |

FilterImpl (excluding FilterHandle methods)

| Field | Type |
| ---- | ---- |
| active | boolean |
| types | GestureType bitflags |
| mode | FilterMode |
| check | (Point) => bool |
| handlers | Map from GestureType to handler function |

FilterLayer

| Field | Type |
| ---- | ---- |
| active | Set\<FilterImpl> |
| inactive | WeakSet\<FilterImpl> |

GestureHandler

| Field | Type |
| ----- | ---- |
| filterLayers      | Record\<GestureLayer, FilterLayer>     |

| Method | Parameters | Type |
| ---- | ---- | ---- |
| processEvents | PointerEventStream | void |
| private handleGesture | Gesture | void |
| private updateActive | FilterImpl | void |
| makeFilter | GestureLayer | FilterHandle |

# Selection
The selection algorithms are described elsewhere, so this section will just list the classes used:
- `ItemHolder` wraps an item and applies a SIT
- `SelectionBorder` draws an outline around a selection
- `HandleBase` and derived classes implement stretch and rotation handles
- `SelectionBox` has code common between both types of selection box
- `RemoteSelection` implements other client's selection
- `LocalSelection` implements the current user selection

## Class Tables
ItemHolder

| Field | Type |
| ---- | ---- |
| readonly element | SVGGElement |
| readonly sit | SVGMatrix |
| private transform | SVGTransform |

| Method | Parameters | Type |
| ------ | ---------- | ---- |
| updateSit       | DOMMatrixReadOnly           | void     |

SelectionBorder

| Field | Type |
| ---- | ---- |
| readonly element | SVGPolygonElement |
| points | SVGPointList<br>(only stored to work around a GC bug causing a crash in firefox) |

HandleBase

| Field | Type |
| ---- | ---- |
| protected handle | FilterHandle |
| readonly element | SVGGraphicsElement |

| Method | Parameters | Type |
| ---- | ---- | ---- |
| protected abstract getElement | CanvasContext | SVGGraphicsElement |
| protected abstract handleGesture | DragGestureState, srt: DOMMatrixReadOnly | void |

StretchHandle and RotateHandle add no new fields/methods

StretchHandleSet

| Field | Type |
| ----- | ---- |
| handles      | StretchHandle\[]     |

SelectionBox

| Field | Type |
| ---- | ---- |
| protected rootElement | SVGGElement |
| protected itemContainer | SVGGElement |
| protected rootTransform | SVGGElement |
| private stagingContainer | SVGGElement |
| protected unscaled | UnscaledHandle |
| protected srt | MutableState\<DOMMatrix> |
| protected size | State\<Point> |
| protected items | Map\<ItemID, ItemHolder> |
| protected ctx | CanvasContext |
| protected table | BoardTable |

| Method | Parameters | Type |
| ---- | ---- | ---- |
| addFromTransforms | TransformRecord\[], Transform | void |
| addFromCanvas | ItemEntry\[] | arguments for SelectionAddItems |

RemoteSelection

| Field | Type |
| ----- | ---- |
| private border      | SelectionBorder     |

| Method | Parameters | Type |
| ---- | ---- | ---- |
| addItems | TransformRecord\[], Transform | void |
| moveItems | Transform, TransformRecord[] | void |

LocalSelection

| Field (private) | Type |
| ---- | ---- |
| border | SelectionBorder |
| rotateHandle | RotateHandle |
| stretchHandles | StretchHandleSet |
| srtUpdateSent | bool |
| \_sendSrtUpdate | OwnedInterval (small helper type that cancels a periodic function after it has been freed) |

| Method | Parameters | Type |
| ---- | ---- | ---- |
| private updateSrt | DOMMatrix | void |
| private handleDrag | DragGestureState | void |
| createAddPayload | ItemEntry\[] | SelectionAddItems |
| getFinalTransforms |  | Iterable\<\[ItemId, DOMMatrix]> |
| clear |  | void |
# Managing the canvas
The `CanvasController` class manages the displayed canvas and selection

## Class tables
CanvasController

| Field | Type |
| ---- | ---- |
| private gestures | GestureHandler |
| private coordMapping | MutableState\<CoordinateMapping> |
| private cursorPos | MutableState\<Point> |
| readonly ctx | CanvasContext |
| readonly svgElement | SVGSVGElement |
| private targetRect | DOMRect |
| readonly elementBounds | State\<DOMRect> |
| private activeGestures | ... |
| private cursorTimeouts | TimeoutMap\<number> |
| private currentCursors | MutableState\<Set\<number>> |
| readonly isGesture | State\<bool> |
| readonly propertyStore | ItemPropertyStore |
| readonly origin | MutableState\<Point> |
| readonly zoom | MutableState\<number> |

| Method | Parameters | Type |
| ---- | ---- | ---- |
| probePoint | Point | Iterable\<ItemEntry> |
| getPropertyInstance | ReadonlySet\<ItemEntry> | PropertyInstance |
| private pointerDown | PointerEvent | void |
| private pointerUp | PointerEvent | void |
| private pointerMove | PointerEvent | void |

# Tracking board state
The `BoardTable` class is the core of the system, keeping track of the board state and relaying events to and from other parts of the client.

The other key process is the bootstrap routine, which incrementally fetches data from the server and synchronises the local state with it.

Linked to this is the `ItemEntry`, `RemoteEntry`, and `SelfEntry` types, which track individual pieces of board state and link them to their local representation.

## Class tables
ItemEntry

| Field | Type |
| ---- | ---- |
| id | ItemID |
| item | Item |
| canvasItem | CanvasItem |
| selection | Option\<ItemID> |

RemoteEntry

| Field | Type |
| ---- | ---- |
| id | ClientID |
| items | Set\<ItemID> |
| info | ClientInfo |
| connection | ConnectionState |
| box | Option\<RemoteSelection> |

SelfEntry

| Field | Type |
| ---- | ---- |
| id | ClientID |
| items | MutableStateSet\<ItemID> |
| info | ClientInfo |
| connection | ConnectionState |
| box | Option\<LocalSelection> |

BoardTable

| Field | Type |
| ---- | ---- |
| private items | Map\<ItemID, ItemEntry> |
| private clients | Map\<ClientID, RemoteEntry> |
| private self | SelfEntry |
| readonly ownID | ClientID |
| readonly selectedItems | StateSet\<ItemEntry> |

| Method | Parameters | Type |
| ---- | ---- | ---- |
| private bootstrap |  | void |
| private bindClientEvents |  | void |
| private bindSelectionEvents |  | void |
| private addClient | ClientID | Promise\<void> |
| addItem | ItemID, Item | void |
| get | Iterable\<ItemID> | Iterable\<Option\<ItemEntry>> |
| get | Iterable\<ItemID>, true | Iterable\<ItemEntry> |
| get | ItemID | Option\<ItemEntry> |
| entries |  | Iterable\<ItemEntry> |
| private ensureLocalBox |  | SelfEntry which definitely has a box |
| addOwnSelection | ItemID\[] | void |
| moveOwnSelection | Transform | void |
| cancelSelection |  | void |
| editSelectedItem | ItemEntry | void |

# Combining everything together
The `Board` class contains each of the subsystems and setup logic

## Class Tables
BoardInfo : ClientInfo

| Field | Type |
| ---- | ---- |
| boardName | string |
| clientID | ClientID |

Board

| Field | Type |
| ---- | ---- |
| readonly ui | UIManager |
| readonly client | SessionClient |
| readonly canvas | CanvasController |
| readonly table | BoardTable |
| readonly info | BoardInfo |

| Method | Parameters | Type |
| ---- | ---- | ---- |
| private init |  | void |
| private handlePath | ClientID, Stroke, PathID | void |