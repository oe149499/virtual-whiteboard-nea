import { Logger } from "../Logger.js";
import type { Point } from "../gen/Types.js";
import type { State } from "../util/State.js";
import { point, rad2deg } from "../util/Utils.js";
import { CanvasContext, type UnscaledHandle } from "./CanvasBase.js";
import { GestureLayer, type FilterHandle, type DragGestureState, GestureType } from "./Gesture.js";

const logger = new Logger("canvas/SelectionUI");

const DIRS = [
	[-0.5, -0.5], [-0.5, 0.5], [0.5, 0.5], [0.5, -0.5],
];

export class SelectionBorder {
	public readonly element: SVGPolygonElement;
	private points: SVGPointList; // GC bug in firefox

	public constructor(
		ctx: CanvasContext,
		srt: State<DOMMatrix>,
		size: State<Point>,
	) {
		this.element = ctx.createElement("polygon").addClasses("selection-border");
		this.points = this.element.points;

		for (const [dx, dy] of DIRS) {
			const transformed = srt.with(size)
				.derivedT((t, { x, y }) => {
					const scaled = point(x * dx, y * dy);
					return t.transformPoint(scaled);
				});

			const scaled = ctx.getUnscaledPos(transformed);

			this.points.appendItem(ctx.createPointBy(scaled));
		}
	}
}

abstract class HandleBase {
	protected handle: FilterHandle;

	public readonly element: SVGGraphicsElement;

	public constructor(
		handle: UnscaledHandle,
		srt: State<DOMMatrix>,
		pos: State<Point>,
	) {
		// const pos = srt.with(offset).derivedT((t, p) => t.transformPoint(p));
		// const transform = ctx.createTransform();
		// pos.watchOn(this, p => transform.setTranslate(p.x, p.y));

		const element = this.getElement(handle.ctx);
		// element.transform.baseVal.appendItem(transform);
		this.element = handle.insert(element, pos);


		this.handle = handle.ctx.createGestureFilter(GestureLayer.SelectionHandle)
			.setTest(({ x, y }) => {
				const p = pos.get();
				const dx = Math.abs(x - p.x);
				const dy = Math.abs(y - p.y);
				return dx < 0.1 && dy < 0.1;
			})
			.addHandler(GestureType.Drag, gesture => this.handleGesture(gesture, srt.getSnapshot()));
	}

	protected abstract getElement(ctx: CanvasContext): SVGGraphicsElement;
	protected abstract handleGesture(gesture: DragGestureState, srt: DOMMatrixReadOnly): void;
}

export class RotateHandle extends HandleBase {
	public constructor(
		handle: UnscaledHandle,
		srt: State<DOMMatrix>,
		size: State<Point>,
		private updateSrt: (_: DOMMatrix) => void,
	) {
		const extraOffset = srt.derived(s => {
			const bx = s.c;
			const by = s.d;
			const length = Math.sqrt((bx * bx) + (by * by));
			return point(-bx / length, -by / length);
		});

		const srtOffset = size
			.derived(s => point(0, -s.y / 2))
			.with(srt)
			.derivedT((pos, srt) => srt.transformPoint(pos));

		const totalOffset = extraOffset.with(srtOffset)
			.derivedT((a, b) => point(a.x + b.x, a.y + b.y));

		super(handle, srt, totalOffset);
	}

	protected override getElement(ctx: CanvasContext): SVGGraphicsElement {
		return ctx.createElement("circle")
			.addClasses("selection-handle")
			.setAttrs({
				r: 0.1,
			});
	}

	protected override async handleGesture(gesture: DragGestureState, srt: DOMMatrixReadOnly) {
		const currentDir = Math.atan2(gesture.location.y - srt.f, gesture.location.x - srt.e);

		const identity = new DOMMatrix();

		// logger.debug("Direction: ", currentDir);
		for await (const p of gesture.points) {
			const cursorDir = Math.atan2(p.y - srt.f, p.x - srt.e);
			const rotation = rad2deg(cursorDir - currentDir);

			const newMatrix = identity.rotate(rotation).multiplySelf(srt);
			newMatrix.e = srt.e;
			newMatrix.f = srt.f;

			this.updateSrt(newMatrix);
			// logger.debug("Direction: ", cursorDir);
		}
	}
}

export class StretchHandle extends HandleBase {
	public constructor(
		handle: UnscaledHandle,
		srt: State<DOMMatrix>,
		private offset: State<Point>,
		private updateSrt: (_: DOMMatrix) => void,
	) {
		super(handle, srt, srt.with(offset).derivedT((t, p) => t.transformPoint(p)));
	}

	protected override getElement(ctx: CanvasContext): SVGGraphicsElement {
		return ctx.createElement("rect")
			.addClasses("selection-handle")
			.setAttrs({
				x: -0.1,
				y: -0.1,
				width: 0.2,
				height: 0.2,
			});
	}

	protected override async handleGesture(gesture: DragGestureState, srt: DOMMatrixReadOnly) {
		const startX = gesture.location.x - srt.e;
		const startY = gesture.location.y - srt.f;

		const startLen = (startX * startX) + (startY * startY);

		logger.debug("Start: x %o, y %o, len %o", startX, startY, startLen);

		const offset = this.offset.getSnapshot();

		for await (const { x, y } of gesture.points) {
			const newX = x - srt.e;
			const newY = y - srt.f;

			logger.debug("New: x %o, y %o", newX, newY);

			const factor = ((newX * startX) + (newY * startY)) / startLen;

			logger.debug("Scale factor: ", factor);

			const scaleX = offset.x ? factor : 1;
			const scaleY = offset.y ? factor : 1;
			this.updateSrt(srt.scale(scaleX, scaleY));
		}
	}
}

export class StretchHandleSet {
	private static Directions: Point[] = [];

	static {
		for (const x of [-1, 0, 1]) {
			for (const y of [-1, 0, 1]) {
				if (x == 0 && y == 0) continue;
				this.Directions.push(point(x, y));
			}
		}
	}

	public readonly handles: StretchHandle[];

	public constructor(
		handle: UnscaledHandle,
		srt: State<DOMMatrix>,
		size: State<Point>,
		updateSrt: (_: DOMMatrix) => void,
	) {
		this.handles = StretchHandleSet.Directions.map(p => {
			const offset = size.derived(({ x, y }: Point) => point(x * p.x / 2, y * p.y / 2));
			return new StretchHandle(handle, srt, offset, updateSrt);
		});
	}
}