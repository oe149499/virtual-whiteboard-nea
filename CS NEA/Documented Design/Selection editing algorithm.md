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