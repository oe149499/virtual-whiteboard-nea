import { Logger } from "../Logger.js";
import { PropKey, SingletonPropertyStore } from "../Properties.js";
import { PropertyTemplates, builder } from "../PropertyTemplates.js";
import { StrokeHelper, type CanvasContext, FillHelper } from "../canvas/CanvasBase.js";
import type { DragGestureState, PressGesture } from "../canvas/Gesture.js";
import type { Color, Point, Stroke } from "../gen/Types.js";
import { None } from "../util/Utils.js";
import { ActionTool } from "./Tool.js";

const logger = new Logger("tool/Polygon");

const { keys, schema } = builder()
	.add(PropertyTemplates.StrokeSchema())
	.add("fill", {
		type: "color",
		key: new PropKey("color"),
		displayName: "Fill",
	})
	.build();

function lenSquared(x: number, y: number) {
	return (x * x) + (y * y);
}

export class PolygonTool extends ActionTool {
	public override readonly properties = new SingletonPropertyStore(schema);
	private builder?: PolygonBuilder;
	private startPos?: Point;

	protected override onPressGesture(gesture: PressGesture): void {
		this.processPoint(gesture.location);
	}

	protected override onDragGesture(gesture: DragGestureState): void {
		gesture.points
			.last()
			.then(o => o === None ? gesture.location : o)
			.then(p => this.processPoint(p));
	}

	private processPoint(pos: Point) {
		if (this.builder) {
			if (this.startPos && lenSquared(pos.x - this.startPos.x, pos.y - this.startPos.y) < 0.05) {
				this.finish();
				this.end();
				return;
			}
			this.builder.addPoint(pos);
		} else {
			this.start();
			this.startPos = pos;
			this.startPolygon(pos);
		}
	}

	private startPolygon(pos: Point) {
		const stroke = this.properties.read(keys.stroke);
		const fill = this.properties.read(keys.fill);
		const builder = new PolygonBuilder(this.ctx, stroke, fill);
		this.builder = builder;
		builder.addPoint(pos);
	}

	private finish() {
		const points = this.builder!.finish();
		const stroke = this.properties.read(keys.stroke);
		const fill = this.properties.read(keys.fill);

		this.board.client.method.CreateItem({
			item: {
				type: "Polygon",
				points,
				stroke,
				fill,
			},
		});

		delete this.builder;
	}

	protected override cancelAction(): void {
		if (!this.builder) return;

		this.finish();
	}
}

class PolygonBuilder {
	private elem: SVGPolygonElement;
	private list: SVGPointList;

	private points: Point[] = [];

	public constructor(
		private ctx: CanvasContext,
		stroke: Stroke,
		fill: Color,
	) {
		this.elem = ctx.createRootElement("polygon");
		this.list = this.elem.points;

		StrokeHelper.apply(this.elem, stroke);
		FillHelper.apply(this.elem, fill);

		const livePoint = ctx.createPointBy(ctx.cursorPosition);

		this.list.appendItem(livePoint);
	}

	public addPoint(point: Point) {
		this.list.appendItem(this.ctx.createPoint(point));
		this.points.push(point);
	}

	public finish() {
		this.elem.remove();
		return this.points;
	}
}