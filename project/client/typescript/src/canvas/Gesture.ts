import { Logger } from "../Logger.js";
import { Point } from "../gen/Types.js";
import { asyncMap, peekFirstAsync, wrapIterAsync } from "../util/Utils.js";
import { CanvasContext } from "./CanvasBase.js";
const logger = new Logger("canvas/Gesture");

export type PointerEventStream = {
	start: PointerEvent,
	moves: AsyncIterable<PointerEvent>,
	end: Promise<PointerEvent>,
}

export interface DragGestureState {
	type?: "Drag";
	initialOrigin: Point;
	points: AsyncIterable<Point>;
}

export type Gesture = Required<DragGestureState>;


export class GestureHandler {
	public constructor(private readonly ctx: CanvasContext) { }

	public async processEvents({ start, moves, end }: PointerEventStream) {
		const mapping = this.ctx.coordMapping.getSnapshot();
		const startPoint = this.ctx.translate(start, mapping);
		const [first, rest] = peekFirstAsync(moves);
		const { status, value: _ } = await first.maxTimeout(500);
		if (status == "Err") {
			// Long press or click
		} else {
			this.ongesture?.({
				type: "Drag",
				initialOrigin: mapping.targetOffset,
				points: wrapIterAsync(asyncMap(
					rest[Symbol.asyncIterator](),
					ev => (
						logger.debug("Start point translates to %o", this.ctx.translate(start, mapping)),
						this.ctx.translate(ev, mapping)
					)
				)),
			});
		}
	}

	public ongesture?: (_: Gesture) => void;
}