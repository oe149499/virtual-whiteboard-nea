Coordinate spaces
- Screen
- Canvas
- Selection
	- Fixed offset from canvas when selection starts
Stretch handles
- Located in s-space, rendered in c-space
- Move along line through s-space origin
Steps
- Translate coords from c-space to s-space
	- Have matrix for that
- snap to line
	- ???
- update scaling appropriately
	- Scale relevant basis vectors from distance on line
let x_0 and y_0 be the initial position of the handle in s-space
let x_1 and y_1 be the position of the target location in s-space
let x_2 and y_2 be the position snapped to the line
The scale factor, f, is therefore x_2/x_0
$$\begin{align}
\text{Snap line:}\\
x&=x_0t\\
y&=y_0t\\
t&=\frac x{x_0}\\
y&=\frac{y_0}{x_0}x\\
\text{Perpendicular }&\text{through snap line:}\\
y&=-\frac{x_0}{y_0}x+c\\
y_1&=-\frac{x_0}{y_0}x_1+c\\
c&=y_1+\frac{x_0}{y_0}x_1\\
y&=y_1+\frac{x_0}{y_0}(x_1-x)\\
\text{intersection:}\\
\frac{y_0}{x_0}x_2&=y_1+\frac{x_0}{y_0}x_1-\frac{x_0}{y_0}x_2\\
\left(\frac{y_0}{x_0}+\frac{x_0}{y_0}\right)x_2&=y_1+\frac{x_0}{y_0}x_1\\
x_2&=\frac{y_1+\frac{x_0}{y_0}x_1}{\frac{y_0}{x_0}+\frac{x_0}{y_0}}\\
f&=\frac{y_1+\frac{x_0}{y_0}x_1}{y_0+\frac{x_0^2}{y_0}}
\end{align}$$

## New selection system
- Selected items
	- Selection Root Transform
		- Transformation from unscaled origin to current selection box
		- Selection Item transform
			- Transformation from item original transform to transform in unscaled selection
			- Final item transformation will be SRT \* SIT
- Items passed around in holder elements with SIT
- Root item container with SRT
### Adding items
- All items should remain stationary
- SRT should be reset to a translation
- New SITs should be a translation
- Need bounding box of new+old combined, can be done with SVG APIs
```xml
<svg>
  <g class="selection-container">
    <g class="selection-item-container">
      <g class="selection-root-transform" transform="[SRT]">
        <g class="selection-item-holder" transform="[SIT]">
          <!-- item -->
        </g>
      </g>
      <g class="selection-staging-container">
        <!-- Add items here before bounding box calculations -->
      </g>
    </g>
    <g class="selection-ui">
      <!-- Any other selection UI that should be rendered seperately-->
    </g>
  </g>
  <g class="item-container">
    <!-- ... -->
  </g>
</svg>
```
Steps for adding items:
- Move items to staging container
- Find bounding box with `getBBox`
- new SRT will be translation to bbox centre
- For existing items:
	- Let $R_0$, $I_0$, $R_1$, and $I_1$ be the new and old SRTs and SITs
	- $$
\begin{align}
R_1I_1&=R_0I_0\\
R_1^{-1}R_1I_1&=R_1^{-1}R_0I_0\\
I_1&=(R_1^{-1}R_0)I_0
\end{align}
$$
 - For new items:
	 - $$\begin{align}R_1I_1&=I\\I_1&=R_1^{-1}\end{align}$$
- Compute new SITs as above and update/create holders
### Moving the selection
Dragging: translate SRT
Rotation:
- Handle will be on y-basis of SRT
- On start, store current SRT inc. rotation
- On cursor move, find canvas-space angle from SRT origin to cursor
- Rotate SRT accordingly
Stretching:
- Need to snap in canvas-space
- Subtract origin, then component in direction of handle 
