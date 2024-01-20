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

export type Gesture = Required<DragGestureState>;


export class GestureHandler {
	public constructor(private readonly ctx: CanvasContext) { }

	public async processEvents({ start: _1, moves, end }: PointerEventStream) {
		const mapping = this.ctx.coordMapping.getSnapshot();
		const first = moves.peek();
		const { status, value: _ } = await first.maxTimeout(500);
		if (status == "Err"/*/false/**/) {
			// Long press or click
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