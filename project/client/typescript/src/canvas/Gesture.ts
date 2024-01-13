import { Point } from "../gen/Types";

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
	public processEvents({ start, moves, end }: PointerEventStream) {

	}

	public ongesture?: (_: Gesture) => void;
}