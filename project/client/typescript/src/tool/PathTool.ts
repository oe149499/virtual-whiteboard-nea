import { Logger } from "../Logger.js";
import { Property, buildProperties, buildPropertiesDeferred } from "../Properties.js";
import { StrokeHelper } from "../canvas/CanvasBase.js";
import { PathHelper } from "../canvas/Path.js";
import { DragGestureState } from "../ui/CanvasView.js";
import { ActionToolBase } from "./Tool.js";
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

		await this.board.client.method.BeginPath({ stroke });

		const pathElem = this.board.canvas.ctx.createElement("path");
		pathElem.setAttribute("fill", "none");
		this.board.canvas.addRawElement(pathElem);

		const helper = new PathHelper(pathElem, await points.pop());
		new StrokeHelper(pathElem.style, stroke);

		logger.debug("iterating over points");

		for await (const point of points) {
			const node = {
				position: point,
				velocity: { x: 0, y: 0 },
			};
			await this.board.client.method.ContinuePath({ points: [node] });
			helper.addNodes({
				position: point,
				velocity: { x: 0, y: 0 },
			});
		}

		logger.debug("points done");

		pathElem.remove();

		await this.board.client.method.EndPath({});
	}

	protected override cancel(): void {

	}
}