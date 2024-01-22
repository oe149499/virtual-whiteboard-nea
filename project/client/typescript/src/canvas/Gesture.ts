import { Logger } from "../Logger.js";
import { Point } from "../gen/Types.js";
import { AsyncIter } from "../util/AsyncIter.js";
import { None } from "../util/Utils.js";
import { CanvasContext } from "./CanvasBase.js";
const logger = new Logger("canvas/Gesture");

export type PointerEventStream = {
	start: PointerEvent,
	moves: AsyncIter<PointerEvent>,
	end: Promise<PointerEvent>,
}

export interface DragGestureState {
	type?: "Drag";
	initialOrigin: Point;
	location: Point;
	points: AsyncIter<Point>;
}

export interface PressGesture {
	type?: "Click";
	location: Point;
}

export interface LongPressGesture {
	type?: "LongClick";
	location: Point;
}

export type Gesture = Required<DragGestureState | PressGesture | LongPressGesture>;


export class GestureHandler {
	public constructor(private readonly ctx: CanvasContext) { }

	public async processEvents({ start, moves, end }: PointerEventStream) {
		const mapping = this.ctx.coordMapping.getSnapshot();
		const first = moves.peek().maxTimeout(500);
		const endTimeout = end.maxTimeout(500);
		const { status, value } = await first;
		if (status == "Err" || value === None) {
			logger.debug("First movement timed out");
			const endRes = await endTimeout;
			if (endRes.status === "Err") {
				this.ongesture?.({
					type: "LongClick",
					location: this.ctx.translate(start, mapping),
				});
			} else {
				this.ongesture?.({
					type: "Click",
					location: this.ctx.translate(endRes.value, mapping),
				});
			}
		} else {
			logger.debug("First movement didn't time out");
			this.ongesture?.({
				type: "Drag",
				initialOrigin: mapping.targetOffset,
				location: this.ctx.translate(start, mapping),
				points: moves.map(
					ev => this.ctx.translate(ev, mapping),
				),
			});
		}
	}

	public ongesture?: (_: Gesture) => void;
}