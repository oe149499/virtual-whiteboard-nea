import { Logger } from "../Logger.js";
import { Point } from "../gen/Types.js";
import { AsyncIter } from "../util/AsyncIter.js";
import { None, rangeInclusive } from "../util/Utils.js";
import type { CanvasContext } from "./CanvasBase.js";
const logger = new Logger("canvas/Gesture");

export type PointerEventStream = {
	start: PointerEvent,
	moves: AsyncIter<PointerEvent>,
	end: Promise<PointerEvent>,
}

export interface DragGestureState {
	type?: GestureType.Drag;
	initialOrigin: Point;
	location: Point;
	points: AsyncIter<Point>;
}

export interface PressGesture {
	type?: GestureType.Click;
	location: Point;
}

export interface LongPressGesture {
	type?: GestureType.LongClick;
	location: Point;
}

export type Gesture<T extends GestureType = GestureType> = Extract<Required<DragGestureState | PressGesture | LongPressGesture>, { type: T }>;

export enum GestureType {
	Drag = 1 << 0,
	Click = 1 << 1,
	LongClick = 1 << 2,
}

export enum GestureLayer {
	Lowest,
	BelowItems,
	Items,
	AboveItems,
	Selection,
	SelectionHandle,
	Highest,
}

export const GestureLayers: GestureLayer[] = [...rangeInclusive(GestureLayer.Lowest, GestureLayer.Highest)].reverse();

export interface GestureFilter {
	layer: GestureLayer;
	types: GestureType;
	check(canvasLocation: Point): boolean;
	handle(gesture: Gesture): void;
}

export interface FilterHandle {
	pause(): this;
	resume(): this;
	setTest(f: (_: Point) => boolean): this;
	addHandler<T extends GestureType>(type: T, handler: (_: Gesture<T>) => void): this;
	removeHandler(type: GestureType): this;
}

class FilterHandleImpl implements FilterHandle {
	public constructor(public readonly layer: GestureLayer, private updateActive: (_: FilterHandleImpl) => void) { }

	public active = true;
	public types = 0 as GestureType;
	public check = (_: Point) => true;
	public handlers: { [K in GestureType]?: (_: Gesture<K>) => void } = {};

	public handle<T extends GestureType>(gesture: Gesture<T>) {
		// @ts-ignore enum generics
		this.handlers[gesture.type]?.(gesture);
	}

	pause(): this {
		this.active = false;
		this.updateActive(this);
		return this;
	}

	resume(): this {
		this.active = true;
		this.updateActive(this);
		return this;
	}

	setTest(f: (_: Point) => boolean): this {
		this.check = f;
		return this;
	}

	addHandler<T extends GestureType>(type: T, handler: (_: Gesture<T>) => void): this {
		this.types |= type;
		// @ts-ignore i want enum generics
		this.handlers[type] = handler;
		return this;
	}
	removeHandler(type: GestureType): this {
		this.types &= ~type;
		return this;
	}
}

type FilterLayer = {
	active: Set<FilterHandleImpl>,
	inactive: WeakSet<FilterHandleImpl>,
}

type FilterLayers = Record<GestureLayer, FilterLayer>;

function buildFilterLayers(): Record<GestureLayer, FilterLayer> {
	const out = {} as Partial<FilterLayers>;
	for (const layer of GestureLayers) {
		out[layer] = {
			active: new Set(),
			inactive: new WeakSet(),
		};
	}
	return out as FilterLayers;
}

export class GestureHandler {
	private filterLayers = buildFilterLayers();

	public constructor(private readonly ctx: CanvasContext) {
	}

	public async processEvents({ start, moves, end }: PointerEventStream) {
		const mapping = this.ctx.coordMapping.getSnapshot();
		const first = moves.peek().maxTimeout(500);
		const endTimeout = end.maxTimeout(500);
		const { status, value } = await first;
		if (status == "Err" || value === None) {
			logger.debug("First movement timed out");
			const endRes = await endTimeout;
			if (endRes.status === "Err") {
				this.handleGesture({
					type: GestureType.LongClick,
					location: this.ctx.translate(start, mapping),
				});
			} else {
				this.handleGesture({
					type: GestureType.Click,
					location: this.ctx.translate(endRes.value, mapping),
				});
			}
		} else {
			logger.debug("First movement didn't time out");
			this.handleGesture({
				type: GestureType.Drag,
				initialOrigin: mapping.targetOffset,
				location: this.ctx.translate(start, mapping),
				points: moves.map(
					ev => this.ctx.translate(ev, mapping),
				),
			});
		}
	}

	private handleGesture(gesture: Gesture) {
		//logger.debug("", GestureLayers);
		for (const layer of GestureLayers) {
			const filters = this.filterLayers[layer];
			//logger.debug("Layer: %o, filters: %o", layer, filters);
			for (const filter of filters.active) {
				//logger.debug("Testing filter: ", filter);
				if (gesture.type & filter.types) {
					if (filter.check(gesture.location)) {
						filter.handle(gesture);
						return;
					}
				}
			}
		}
	}

	private updateActive = (handle: FilterHandleImpl) => {
		const layer = this.filterLayers[handle.layer];
		if (handle.active) {
			layer.inactive.delete(handle);
			layer.active.add(handle);
		} else {
			layer.active.delete(handle);
			layer.inactive.add(handle);
		}
	};

	public makeFilter(layer: GestureLayer): FilterHandle {
		const handle = new FilterHandleImpl(layer, this.updateActive);
		this.filterLayers[layer].active.add(handle);
		return handle;
	}

	/** @deprecated */
	public ongesture?: (_: Gesture) => void;
}