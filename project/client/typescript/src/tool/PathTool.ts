import { Logger } from "../Logger.js";
import { Property, buildProperties, buildPropertiesDeferred } from "../Properties.js";
import { StrokeHelper } from "../canvas/CanvasBase.js";
import { PathHelper } from "../canvas/Path.js";
import { DragGestureState } from "../canvas/Gesture.js";
import { ActionToolBase } from "./Tool.js";
import { splitFirstAsync } from "../util/Utils.js";
const logger = new Logger("tool/Path");

export class PathTool extends ActionToolBase {
	private propStore = {
		stroke: {
			width: 1,
			color: "black",
		},
	};

	protected override buildProperties(): Property[] {
		return buildPropertiesDeferred(() => this.propStore, ($) => {
			$.struct("stroke", ($) => {
				$.number("width").as("Stroke Width");
				$.color("color").as("Stroke Color");
			});
		});
	}

	protected override async onDragGesture(gesture: DragGestureState) {
		const { points } = gesture;
		const stroke = { ...this.propStore.stroke };

		this.start();

		await this.board.client.method.BeginPath({ stroke });

		const pathElem = this.board.canvas.ctx.createElement("path");
		pathElem.setAttribute("fill", "none");
		this.board.canvas.addRawElement(pathElem);
		const [first, rest] = await splitFirstAsync(points);

		const helper = new PathHelper(pathElem, first);
		new StrokeHelper(pathElem.style, stroke);

		for await (const point of rest) {
			const node = {
				position: point,
				velocity: { x: 0, y: 0 },
			};
			await this.board.client.method.ContinuePath({ points: [node] });
			helper.addNode({
				position: point,
				velocity: { x: 0, y: 0 },
			});
		}

		this.end();

		pathElem.remove();

		await this.board.client.method.EndPath({});
	}

	protected override cancel(): void {

	}
}