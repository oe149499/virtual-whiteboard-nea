# Selection
A user's selection is modelled as a separate coordinate space from the global/canvas space, which has its origin at the centre of the user's transform and the same basis at the moment when the selection is initialised.

The selection is then processed in terms of two transformation matrices:
- The Selection Root Transform (abbreviated to SRT)
	- This is the transformation mapping selection space back to canvas space
	- This is updated when the whole transform is edited by dragging it around or rotating it, and regenerated when adding or removing items from the selection
- The Selection Item Transforms (abbreviated to SITs)
	- These transform each item from its original location in canvas space to its current location in selection space
	- These are updated when new items are added to the selection
## Implementation in SVG
The selection hierarchy is implemented by the following layout
- Root selection container
	- Item container - root for all items in the selection
		- SRT container - applies the SRT to its children
			- SIT containers - Each item is wrapped in a container applying its SIT
		- Staging container - new items being added are moved here so the new bounding box can be computed by the item container
## Adding items for the selection
The algorithm can be derived based on the following constraints:
- For every item, its final transform must be unchanged by the whole procedure
	- The final transform of an item is equal to the product of the SRT and the item's SIT
	- For new items, this must be the identity
- The new selection space should be axis-aligned with canvas space and have no scaling, and should be centred on the bounding box of the complete set of items
	- This forces the new SRT to consist only of a translation
This leads to the following steps:
- First, compute the bounding box of the new selection
	- Move all new items to the staging container
	- Acquire the bounding box through the SVG `getBBox` API
- The new SRT can be calculated as the translation from the origin to the centre of the bounding box
- For existing items, their new SITs are derived as follows:
$$
\begin{align}
R_1I_1&=R_0I_0\\
R_1^{-1}R_1I_1&=R_1^{-1}R_0I_0\\
I_1&=(R_1^{-1}R_0)I_0
\end{align}
$$
- For new items, their SITs should be the inverse of the new SRT such that the net transform cancels out
## Moving the selection
- Dragging is simply translating the SRT
- Rotation:
	- At the beginning of the gesture, store the current SRT and the direction (in canvas space) from the selection origin to the cursor
	- When the cursor moves, find the new direction from the selection origin to the cursor
	- Update the SRT to the initial value rotated by the difference between the initial angle and the current angle
- Stretching:
	- At the beginning of the gesture, store the current SRT and the vector from the selection origin to the cursor
	- When the cursor moves, find the new vector from the selection origin to the cursor
	- The scale factor is computed as the component of the new vector in the direction of the initial one
	- Update the SRT by scaling in the x and/or y directions as appropriate