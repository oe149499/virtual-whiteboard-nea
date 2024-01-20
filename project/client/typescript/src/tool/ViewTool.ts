import { Logger } from "../Logger.js";
import { DragGestureState } from "../canvas/Gesture.js";
import { None } from "../util/Utils.js";
import { ModeToolBase } from "./Tool.js";
const logger = new Logger("tool/ViewTool");

export class ViewTool extends ModeToolBase {
	public override async onDragGesture(gesture: DragGestureState) {
		logger.trace("gesture", gesture);

		const firstPoint = await gesture.points.next();
		if (firstPoint === None) return;

		const offsetX = gesture.initialOrigin.x + firstPoint.x;
		const offsetY = gesture.initialOrigin.y + firstPoint.y;

		logger.trace("drag", firstPoint, offsetX, offsetY);

		for await (const point of gesture.points) {
			logger.trace("Point: ", point);
			this.canvas.setOrigin({
				x: offsetX - point.x,
				y: offsetY - point.y,
			});
		}
	}
}