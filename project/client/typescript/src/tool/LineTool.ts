import { SingletonPropertyStore } from "../Properties.js";
import { PropertyTemplates } from "../PropertyTemplates.js";
import { StrokeHelper } from "../canvas/CanvasBase.js";
import type { DragGestureState } from "../canvas/Gesture.js";
import type { Point } from "../gen/Types.js";
import { point } from "../util/Utils.js";
import { ActionToolBase } from "./Tool.js";

const { schema, keys } = PropertyTemplates.StrokeSchema();

export class LineTool extends ActionToolBase {
	public override readonly properties = new SingletonPropertyStore([schema]);

	protected override async onDragGesture(gesture: DragGestureState) {
		const elem = this.ctx.createRootElement("line");
		const stroke = this.properties.read(keys.stroke);

		new StrokeHelper(elem.style, stroke);

		this.start();

		const start = gesture.location;
		elem.setAttrs({
			x1: start.x,
			y1: start.y,
		});

		let end = start;

		for await (end of gesture.points) {
			elem.setAttrs({
				x2: end.x,
				y2: end.y,
			});
		}


		this.end();

		await this.board.client.method.CreateItem({
			item: {
				type: "Line",
				start,
				end,
				stroke,
			},
		});

		elem.remove();
	}

	protected override cancel(): void { }
}