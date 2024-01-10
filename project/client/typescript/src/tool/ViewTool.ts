import { Logger } from "../Logger.js";
import { DragGestureState } from "../ui/CanvasView.js";
import { ModeToolBase } from "./Tool.js";
const logger = new Logger("tool/ViewTool");

export class ViewTool extends ModeToolBase {
	public override async onDragGesture(gesture: DragGestureState) {
		const firstPoint = await gesture.points.pop();
		const offsetX = gesture.initialOrigin.x + firstPoint.x;
		const offsetY = gesture.initialOrigin.y + firstPoint.y;
		for await (const point of gesture.points) {
			logger.trace("Point: ", point);
			this.board.ui.canvas.setOrigin({
				x: offsetX - point.x,
				y: offsetY - point.y,
			});
		}
	}
}