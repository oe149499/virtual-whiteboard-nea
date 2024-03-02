# Requesting information
The information which can be requested by a client is as follows:
- Get Item IDs
	- This should use the Method protocol since should be atomic
- Get Client IDs - Same as above
- Get all information about a client
	- ClientInfo
	- List of currently active paths
	- Selection
	- Since this is effectively only one data point this should be a Method
- Fetch a list of items
	- This is likely to return a large quantity of data so using Iterate enables processing before the full response is complete
- Receive a currently active path
	- This is delivered as the path is received so Iterate is best suited for this
# Creating items
The methods of creating items are as shown:
- Create an item
	- Parameters - item data
	- Return value - item ID
- Begin a path
	- Parameters - stroke
	- Returns - Path ID
- Continue a path
	- Parameters - Path ID, spline nodes
	- Returns - nothing
- Close a path
	- Parameters - Path ID
	- Returns - Item ID of newly created item
# Editing items
All of these operations use the Method protocol since they represent a single operation with only a status code as response
- Select one or more new items
	- Parameters - New SRT, SITs of new and existing items
	- Response - Whether each new item was successfully added
- Deselect one or more items
	- Parameters - Item IDs and new position of each item
	- Response - success or failure
- Move own selection or change relative transformation of items
	- Parameters - New SRT, optionally updated SITs
	- Response - none
- Edit a single item
	- Parameters - Item ID, new item
	- Response - none
- Edit the same property on multiple items
	- Parameters - Item IDs, changes
	- Response - Status codes
- Delete one or more items
	- Parameters - Item IDs
	- Response - Status codes
