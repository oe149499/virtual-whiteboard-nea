# Basic structures
Aliases for specific uses of types:
```ts
type Color = string;
```
Point - a general 2D vector:
```typescript
interface Point {
	x: number;
	y: number;
}
```
Stroke - a combination of stroke width and colour:
```ts
interface Stroke {
	width: number;
	color: Color;
}
```
Transform - a 2D transformation, corresponds to a 3x2 matrix:
```ts
interface Transform {
	origin: Point;
	basisX: Point;
	basisY: Point;
}
```
Spline Node - a part of a hand-drawn path:
```ts
interface SplineNode {
	position: Point;
	velocity: Point;
}
```
# Item types
Common properties of items:
```ts
interface TransformItem {
	transform: Transform;
}

interface StrokeItem {
	stroke: Stroke;
}

interface FillItem {
	fill: Color;
}
```
Item types:
```ts
interface RectangleItem extends TransformItem, StrokeItem, FillItem {
	type: "Rectangle";
}

interface EllipseItem extends TransformItem, StrokeItem, FillItem {
	type: "Ellipse";
}

interface LineItem extends StrokeItem {
	type: "Line";
	start: Point;
	end: Point;
}

interface PolygonItem extends StrokeItem, FillItem {
	type: "Polygon";
	points: Point[];
}

interface PathItem extends StrokeItem, TransformItem {
	type: "Path";
	nodes: SplineNode[];
}

interface ImageItem extends TransformItem {
	type: "Image";
	url: string;
	description: string;
}

interface TextItem extends TransformItem {
	type: "Text";
	text: string;
}

interface LinkItem extends TransformItem {
	type: "Link";
	text: string;
	url: string;
}
```
# Other supporting types
Location update - change in the position of an item:
```ts
type LocationUpdate = { "Transform": Transform } | { "Points": Point[]};
```
Batch changes - changes that can be made to multiple items at once:
```ts
interface BatchChanges {
	fill?: Color;
	stroke?: Stroke;
}
```
