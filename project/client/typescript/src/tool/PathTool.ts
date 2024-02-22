import { Logger } from "../Logger.js";
import { SingletonPropertyStore } from "../Properties.js";
import { StrokeHelper } from "../canvas/CanvasBase.js";
import { PathHelper } from "../canvas/Path.js";
import { DragGestureState } from "../canvas/Gesture.js";
import { ActionToolBase } from "./Tool.js";
import { PropertyTemplates } from "../PropertyTemplates.js";
const logger = new Logger("tool/Path");

const { schema, keys } = PropertyTemplates.StrokeSchema();


export class PathTool extends ActionToolBase {
	public override readonly properties = new SingletonPropertyStore([schema]);

	protected override async onDragGesture(gesture: DragGestureState) {
		const { points, location: first } = gesture;
		const stroke = this.properties.read(keys.stroke);

		this.start();

		const pathId = await this.board.client.method.BeginPath({ stroke });

		const pathElem = this.ctx.createRootElement("path");
		pathElem.setAttribute("fill", "none");
		const helper = new PathHelper(pathElem, first);
		// TODO: maybe add static methods
		new StrokeHelper(pathElem.style, stroke);

		for await (const point of points) {
			const node = {
				position: point,
				velocity: { x: 0, y: 0 },
			};
			// TODO: maybe batch calls? also don't wait for result
			await this.board.client.method.ContinuePath({ pathId, points: [node] });
			helper.addNode({
				position: point,
				velocity: { x: 0, y: 0 },
			});
		}

		this.end();

		pathElem.remove();

		await this.board.client.method.EndPath({ pathId });
	}

	protected override cancel(): void {

	}
}