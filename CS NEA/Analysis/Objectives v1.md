# 1 Layout and Interface
The program interface should consist of the following components:
## 1.1 Board
The full program area should be covered by a view box for an interactive **board** area
## 1.2 Panels
In several cases the program will display a floating **panel** area with the following properties:
1. A **visibility button** should be located adjacent to the panel which toggles its visibility
2. In certain contexts, a panel's contents are not relevant and the panel should be **disabled**. While a panel is **disabled**, it should be hidden regardless of its visibility, and its **visibility button** should be greyed out or hidden unless specified otherwise. When the panel is no longer **disabled**, it should restore its previous visibility status
## 1.3 Toolbox
The program must display a "Toolbox" **panel** which consists of a grid of **tool** icons:
1. When clicked, the corresponding **tool** will be activated
2. The icon corresponding to the active **tool** must be indicated or otherwise highlighted
3. During a **multi-press action**, the toolbox should be **disabled** and its **visibility button** replaced with a button to cancel the **multi-press action**.
## 1.3 Properties
The program must display a "Properties" **panel** which contains a list of properties relevant to the currently **selected** **item**(s):
1. When a single **item** is selected, each of the properties of the **item** are listed and can be edited, any **item**-specific actions, along with the ability to delete the item
2. When multiple **item**s are selected, any properties that exist for all of the items, with the exception of transformation, are listed
3. When no **item**s are selected, the properties of the current **tool** are displayed, if any.
4. If there are no properties that can be displayed, the **panel** should be **disabled**
## 1.4 View controls
The program must display a "View" **panel** with the following buttons:
1. Zoom in
2. Zoom out
3. Reset zoom

# 2 Items
A board may contain any number of **item**s, which are the basic visual pieces of the board
## 2.1 Units
Properties of an **item** will use the following units unless specified:

| Type           | Unit                                                                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **distance**   | centimetres of screen at the default zoom level                                                                                               |
| **point**      | A global position measured as **distance** to the right and **distance** up from the origin                                                   |
| **angle**      | Rotation measured in degrees clockwise from upwards (-180 to 180, values outside this range should be converted automatically when processed) |
| **color**      | RGBA hex color value (each channel is 0-255), though a color picker may provide other formats                                                 |
| **list\[T\]** | An arbitrary length ordered collection of **T**                                                                                                                                              |
## 2.2 Common properties of items
The following properties apply to many items:
1. Transform, consisting of the following sub-properties:
	1. Position: the global position of the centre of the **item**'s bounding box as a **point**
	2. Rotation: the **angle** of an item relative to its centre
	3. Scale: the unit-less X and Y stretch of an **item**, *applied before rotations*
2. Stroke:
	1. Weight: a **distance** representing the width of the **item**'s border
	2. Color: the **color** of an item's border
3. Fill: the **color** which a shape is filled in with
## 2.3 Item types
The following types of **item** exist:
1. Basic shapes:
	- A simple item which draws one of the following shapes:
		1. Rectangle - A 1cm by 1cm filled rectangle
		2. Ellipse - A circle of radius 0.5cm
	- Properties: Transform, Stroke, Fill
2. Multi-point shapes:
	1. Line: a segment connecting two points
		- Properties: Stroke
			- Start: **point**
			- End: **point**
		- Actions: Swap start/end
	2. Polygon: a closed loop of points:
		- Properties: Stroke, Fill
			- Vertices: **list\[point\]**
3. Path: a hand-drawn curve
	- Once completed, a path cannot be modified, but may be transformed
	- Unlike other **item**s, a path should be shown to other users while it is still being drawn
	- Properties: Transform, Stroke
4. Other:
	- Image?: An image uploaded by a client
		- Properties: Transform

# 3 Tools
The following **tools** should be available:
## 3.1 Selection
1. Select
	- On click, **selects** the topmost **item** under the cursor if one is present
	- On drag, **selects** the **item** under the cursor and begins moving it
	- Properties: None
2. Multi-select
	- On click, **selects** all **items** under the cursor
	- On drag, **selects** all **items** fully contained within a rectangle between the beginning and end of the drag
	- Properties: None
## 3.2 Creation
1. Rectangle
	- On click, creates a rectangle with the default size centred at the cursor
	- On drag, creates a rectangle with corners at the beginning and end of the drag
	- Properties:
		- Scale: defaults to 1x1, determines the size of rectangles created by clicking
		- Stroke, Fill: Default values for all rectangles created
2. Ellipse
	- Creates an ellipse, functions identically to Rectangle except on drag, creates a circle centred on the beginning point and passing through the end point
	- Properties: Scale, Stroke (defaults)
3. Line
	- On drag, creates a line from the beginning to end of the drag
	- Properties:
		- Stroke (defaults)
4. Polygon
	- On click, creates a polygon **item** with one vertex at the click location, and begins a **multi-press action** for adding points to the polygon
		- Successive clicks add further points
		- Cancelling the action should deselect the **item** and not remove it
	- Properties: Stroke, Fill (defaults)
5. Path
	- On drag, draws a path **item**
	- Properties: Stroke (defaults)
6. Image?
	- On activation, prompts the user to upload an image, then places it at the centre of the screen.
		- The tool is then immediately switched to Select

# 4 Editing
## 4.1 Controls
The board should display an **transform box** around the currently **selected** **item**(s)
1. The box should consist of non-filled rectangle around the bounding box of the **item**s
	- If a single **item** is selected, and that **item** has a Transform property, the bounding box should be rotated and scaled to match the transform
	- If a single **item** is selected, and that **item** does not have a Transform property, the bounding box should default to the smallest aligned rectangle which completely contains the **item**
	- If multiple **item**s are selected, the bounding box should be the smallest aligned rectangle which fully contains the bounding box of every selected **item**
2. The box should be computed once at the beginning of the **selection** and not change relative to the **item**s while the **selection** is active
3. At the corners and midpoints of the edges of the **transform box**, there should be square stretch handles:
	- Midpoint handles stretch the **item**(s) only in the direction normal to the edge, such that the opposite edge is not affected by the movement
	- Corner handles stretch the **item**(s) such that the opposite corner does not move and the aspect ratio of the **selection** is unchanged
4. At the "top" of the **transform box** there should be a circular rotation handle
	- Dragging the handle rotates the **selection** around its centre
5. A drag action anywhere else in the **transform box** should translate the **item**(s) by the 
6. When editing multiple **item**s, or **item**(s) with no Transform property, changes may be shared with other clients in a qualitative form, but the final state *as computed by the editing client* must be shared when the **selection** is dropped
# 5 Synchronisation
The program should enable multiple clients to edit and view a **board** simultaneously
## 5.1 Synchronicity
Any edits made to the graph should be displayed on other clients with minimal delay:
1. The creation of simple **item**s should be immediately synchronised
2. The beginning of path-like **item**s should be immediately synchronised, and any incremental stages should be shared within one second of the individual stage being sent. (This enables bundling of edits in the case of limited bandwidth)
3. Any edits made to existing **item**s should be shared within one second of the edit
## 5.2 Consistency
The board state must be the same across all clients:
1. At any point at which no information remains to be transmitted to or from any client, the complete list of **item**s and their properties held by each client must be exactly identical
2. When a client **selects** an **item**, this must be transmitted to other clients, which must not attempt to **select** the same item
	1. If two clients simultaneously attempt to **select** an **item**, the first to be processed will be successful and the others must be notified that the **item** is unavailable
	2. A client should not attempt to edit an **item** which it has not **selected**, and any attempt to do so must be rejected.
		- The client may permit the user to attempt to edit an **item** before confirmation of **selection** is received, but must not assume that such an edit will be successful
	3. When a client creates an **item**, it will immediately be **selected** and the client may assume this
## 5.3 Reliability
The program must function as expected whenever possible
1. In the case of network failure, the program should quietly alert the user and enable changes to be made client-side where possible
	1. The program should attempt to reconnect periodically and notify the user when it is successful
	2. If a client loses connection while an **item** is **selected**, the **item** will stay **selected** for a configurable duration before other clients are able to **select** it
	3. Conflicting changes made during the interruption should be resolved by either the most recent edit or a best-effort attempt to merge edit histories
2. In the case of a power failure or unexpected termination of the host, the board should *always* be restorable to a state less than 10 seconds (or a configurable duration) old