import { Point, Transform } from "../gen/Types.js";
import { collectStateOf, mutableStateOf } from "../util/State.js";
import { None, Option, point } from "../util/Utils.js";
import { CanvasContext, TransformHelper } from "./CanvasBase.js";
import { Gesture } from "./Gesture.js";

export class SelectionBox {
	container: SVGGElement;
	outerBorder: SVGRectElement;

	selectionOrigin = mutableStateOf(point());
	selectionSize = mutableStateOf(point(10));

	constructor(private ctx: CanvasContext) {
		this.container = ctx.createRootElement("g");
		this.outerBorder = this.container.createChild("rect")
			.addClasses("selection");

		this.selectionOrigin.watch(({ x, y }) => this.outerBorder.setAttrs({ x, y })).poll();
		this.selectionSize.watch(({ x, y }) => this.outerBorder.setAttrs({ width: x, height: y })).poll();
	}

	public testIntersection({ x, y }: Point): boolean {
		const origin = this.selectionOrigin.get();
		if (x < origin.x || y < origin.y) return false;
		const size = this.selectionSize.get();
		if (x - origin.x > size.x || y - origin.y > size.y) return false;
		return true;
	}

	public async handleGesture(gesture: Gesture) {
		if (gesture.type == "Drag") {
			const start = this.selectionOrigin.getSnapshot();
			const ox = start.x - gesture.location.x;
			const oy = start.y - gesture.location.y;

			for await (const { x, y } of gesture.points) {
				this.selectionOrigin.set({
					x: x + ox,
					y: y + oy,
				});
			}
		}
	}
}