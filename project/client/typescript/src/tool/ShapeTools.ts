import { PropKey, SingletonPropertyStore } from "../Properties.js";
import { PropertyTemplates, builder } from "../PropertyTemplates.js";
import type { DragGestureState, PressGesture } from "../canvas/Gesture.js";
import type { Item, Transform } from "../gen/Types.js";
import { None, point } from "../util/Utils.js";
import { ActionToolBase } from "./Tool.js";

const { keys, schema } = builder()
	.add("fill", {
		type: "color",
		key: new PropKey("color"),
		displayName: "Fill",
	})
	.add(PropertyTemplates.StrokeSchema())
	.add(PropertyTemplates.PointPropertySchema("Size", point(1, 1)))
	.build();

abstract class ShapeToolBase extends ActionToolBase {
	override readonly properties = new SingletonPropertyStore(schema);
	protected abstract itemType: "Ellipse" | "Rectangle";

	private sendItem(transform: Transform) {
		const item: Item = {
			type: this.itemType,
			fill: this.properties.read(keys.fill),
			stroke: this.properties.read(keys.stroke),
			transform,
		};

		this.board.client.method.CreateItem({ item });
	}

	protected override async onDragGesture(gesture: DragGestureState) {
		const { x: x1, y: y1 } = gesture.location;
		this.start();

		const end = await gesture.points.last();
		if (end === None) return this.end();

		const { x: x2, y: y2 } = end;

		const middle = point((x1 + x2) / 2, (y1 + y2) / 2);
		const width = Math.abs(x2 - x1);
		const height = Math.abs(y2 - y1);

		this.sendItem({
			origin: middle,
			basisX: point(width, 0),
			basisY: point(0, height),
		});

		this.end();
	}

	protected override onPressGesture(gesture: PressGesture): void {
		this.start();
		this.sendItem({
			origin: gesture.location,
			basisX: point(this.properties.read(keys.point.x) || 1, 0),
			basisY: point(0, this.properties.read(keys.point.y) || 1),
		});
		this.end();
	}

	protected override cancelAction(): void {

	}
}

export class RectangleTool extends ShapeToolBase {
	protected override itemType = "Rectangle" as const;
}

export class EllipseTool extends ShapeToolBase {
	protected override itemType = "Ellipse" as const;
}