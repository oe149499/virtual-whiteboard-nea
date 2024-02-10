import { Board } from "../Board.js";
import { Logger } from "../Logger.js";
import { CanvasContext } from "../canvas/CanvasBase.js";
import { PressGesture } from "../canvas/Gesture.js";
import { UserSelection } from "../canvas/SelectionBox.js";
import { Transform } from "../gen/Types.js";
import { ActionToolBase } from "./Tool.js";
const logger = new Logger("tool/SelectionTool");

export class SelectionTool extends ActionToolBase {
	// private selection: SelectionBox;

	public constructor(
		board: Board,
	) {
		super(board);
		// this.selection = board.canvas.selection;
	}

	protected override cancel(): void {
		this.gestureFilter.pause();
	}

	protected override onPressGesture(gesture: PressGesture): void {
		logger.debug("received press gesture");
		const rect = this.board.canvas.ctx.createRect(gesture.location, { x: 0.1, y: 0.1 });
		//const list = this.board.canvas.svgElement.getIntersectionList(rect, this.board.canvas.svgElement);

		const items = Array.from(this.board.canvas.probePoint(gesture.location))
			.map(({ id }) => id);

		this.board.items.addOwnSelection(items);

		// for (const { id } of items) {
		// 	logger.debug("Selecting item: ", id);
		// 	this.selection.addItem(id);
		// }
	}
}