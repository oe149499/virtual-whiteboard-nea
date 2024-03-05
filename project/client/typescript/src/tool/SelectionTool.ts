import { Board } from "../Board.js";
import { Logger } from "../Logger.js";
import { PressGesture } from "../canvas/Gesture.js";
import { ModeToolBase } from "./Tool.js";
const logger = new Logger("tool/SelectionTool");

export class SelectionTool extends ModeToolBase {
	// TODO: this is very incomplete
	public constructor(
		board: Board,
	) {
		super(board);
	}

	// protected override cancel(): void {
	// 	this.gestureFilter.pause();
	// }

	protected override onPressGesture(gesture: PressGesture): void {
		logger.debug("received press gesture");
		const _rect = this.board.canvas.ctx.createRect(gesture.location, { x: 0.1, y: 0.1 });

		const items = Array.from(this.board.canvas.probePoint(gesture.location))
			.map(({ id }) => id);

		if (items.length === 0) return;

		// this.start();

		this.board.table.addOwnSelection(items);

		// this.end();
	}
}