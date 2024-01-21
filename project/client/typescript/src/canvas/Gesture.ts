import { Logger } from "../Logger.js";
import { Point } from "../gen/Types.js";
import { AsyncIter } from "../util/AsyncIter.js";
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
		const { status, value: _ } = await first;
		if (status == "Err") {
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
			this.ongesture?.({
				type: "Drag",
				initialOrigin: mapping.targetOffset,
				points: moves.map(
					ev => this.ctx.translate(ev, mapping),
				),
			});
		}
	}

	public ongesture?: (_: Gesture) => void;
}