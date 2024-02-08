import { Logger } from "../Logger.js";
import { ItemID, Point } from "../gen/Types.js";
import { MutableState, State, WatchHandle, mutableStateOf } from "../util/State.js";
import { asDomMatrix, point, rad2deg } from "../util/Utils.js";
import { CanvasContext, MatrixHelper, TranslateHelper } from "./CanvasBase.js";
import { CanvasItem } from "./items/CanvasItems.js";
import { DragGestureState, FilterHandle, GestureLayer, GestureType } from "./Gesture.js";
const logger = new Logger("canvas/SelectionBox");

export class SelectionBox {
	private container: SVGGElement;

	private selectionTransform = mutableStateOf(new DOMMatrix());

	private gestureFilter: FilterHandle;

	private selectionSize = mutableStateOf(point(1, 1));

	//private selectionMatrix = asDomMatrix(this.selectionTransform);
	private reverseMatrix = this.selectionTransform.derivedI("inverse");

	private containerTransform: MatrixHelper;

	private items = new Map<ItemID, CanvasItem>();

	private border: BorderBox;
	private itemContainer: SVGGElement;

	constructor(private ctx: CanvasContext) {
		this.container = ctx.createRootElement("g");

		this.border = new BorderBox(ctx, this.container, this.selectionTransform, this.selectionSize);

		this.itemContainer = this.container.createChild("g");

		this.containerTransform = new MatrixHelper(this.itemContainer.transform.baseVal, this.selectionTransform);

		this.gestureFilter = ctx.createGestureFilter(GestureLayer.AboveItems)
			.addHandler(GestureType.Drag, this.handleGesture.bind(this))
			.setTest((p) => {
				const { x, y } = this.reverseMatrix.get().transformPoint(p);
				const s = this.selectionSize.get();
				return Math.abs(x) < s.x / 2 && Math.abs(y) < s.y / 2;
			});

		//this.selectionOrigin.watch(({ x, y }) => this.outerBorder.setAttrs({ x, y })).poll();
		//this.selectionSize.watch(({ x, y }) => this.outerBorder.setAttrs({ width: x, height: y })).poll();
	}

	public addItem(id: ItemID, item: CanvasItem) {
		const newItemHolder = this.container.createChild("g");
		newItemHolder.style.visibility = "hidden";
		this.items.set(id, item);

		for (const item of this.items.values()) {
			const matrix = item.element.getFinalTransform();
			const cont = newItemHolder.createChild("g");
			const transform = this.ctx.createTransform(matrix);
			cont.transform.baseVal.appendItem(transform);
			cont.appendChild(item.element);
		}

		const bounds = newItemHolder.getBBox();

		logger.debug("bounds: ", bounds);

		const center = {
			x: (bounds.left + bounds.right) / 2,
			y: (bounds.top + bounds.bottom) / 2,
		};

		const holderTransform = this.ctx.createTransform();
		holderTransform.setTranslate(-center.x, -center.y);
		newItemHolder.transform.baseVal.appendItem(holderTransform);

		this.itemContainer.appendChild(newItemHolder);

		this.selectionSize.set({ x: bounds.width, y: bounds.height });

		this.selectionTransform.set(asDomMatrix({
			origin: center,
			basisX: point(1, 0),
			basisY: point(0, 1),
		}));
		newItemHolder.style.visibility = "initial";
	}

	public testIntersection(p: Point): boolean {
		logger.debug("Testing for point: ", p);
		const val = this.container.getBBox().testIntersection(p);
		logger.debug("result: ", val);
		return val;
		// const origin = this.selectionOrigin.get();
		// if (x < origin.x || y < origin.y) return false;
		// const size = this.selectionSize.get();
		// if (x - origin.x > size.x || y - origin.y > size.y) return false;
		// return true;
	}

	public async handleGesture(gesture: DragGestureState) {
		const { e: startX, f: startY } = this.selectionTransform.get();
		const ox = startX - gesture.location.x;
		const oy = startY - gesture.location.y;

		for await (const { x, y } of gesture.points) {
			//logger.debug("Point: ", x, y);
			this.selectionTransform.updateBy(t => {
				t.e = x + ox;
				t.f = y + oy;
				return t;
			});
			//logger.debug("", this.selectionTransform.get());
		}
	}
}

const dirs = [
	[-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1],
].map(([x, y]) => point(x / 2, y / 2));

const cornerDirs = [
	[-1, -1], [-1, 1], [1, 1], [1, -1],
].map(([x, y]) => point(x / 2, y / 2));

const rotateDir = point(0, -0.75);

function renderPolygon(ctx: CanvasContext, target: SVGPointList, source: State<Point>[]) {
	const handles = [];
	target.clear();
	for (const [idx, point] of source.entries()) {
		target.appendItem(ctx.createPoint(point.get()));
		const handle = ctx.createPointBy(point).watch(
			p => target.replaceItem(p, idx),
		);
		handles.push(handle);
	}
	return handles;
}

class BorderBox {
	#keepalive = [] as unknown[];
	public readonly element: SVGPolygonElement;
	private handles: StretchHandle[];
	private rotateHandle: RotateHandle;

	public constructor(
		ctx: CanvasContext,
		target: SVGElement,
		transform: MutableState<DOMMatrix>,
		size: MutableState<Point>,
	) {
		const element = target.createChild("polygon").addClasses("selection");
		this.element = element;

		this.#keepalive.push(renderPolygon(
			ctx,
			element.points,
			cornerDirs.map(
				p => transform.with(size).derivedT(
					(t, s) => t.transformPoint({
						x: p.x * s.x,
						y: p.y * s.y,
					}),
				),
			),
		));

		this.handles = dirs.map(offset => new StretchHandle(
			ctx,
			target,
			transform,
			size,
			offset,
		));

		this.rotateHandle = new RotateHandle(
			ctx,
			target,
			transform,
			size,
			rotateDir,
		);
	}
}

abstract class HandleBase {
	private translate: TranslateHelper;
	protected position: State<Point>;
	protected canvasPos: State<Point>;

	protected constructor(
		private elem: SVGGraphicsElement,
		transform: State<DOMMatrix>,
		size: State<Point>,
		offset: Point,
	) {
		this.position = size
			.derived(({ x, y }) => ({ x: x * offset.x, y: y * offset.y }));

		this.canvasPos = this.position
			.with(transform)
			.derivedT((p, t) => t.transformPoint(p));

		this.translate = new TranslateHelper(elem.transform.baseVal, this.canvasPos);
	}
}

class StretchHandle extends HandleBase {
	private gestureFilter: FilterHandle;

	public constructor(
		ctx: CanvasContext,
		target: SVGElement,
		private transform: MutableState<DOMMatrix>,
		size: State<Point>,
		private offset: Point,
	) {
		super(
			target.createChild("rect")
				.addClasses("selection-handle")
				.setAttrs({
					x: -0.1,
					y: -0.1,
					width: 0.2,
					height: 0.2,
				}),
			transform,
			size,
			offset,
		);

		this.gestureFilter = ctx.createGestureFilter(GestureLayer.Highest)
			.setTest(({ x, y }) => {
				const pos = this.canvasPos.get();
				return Math.abs(x - pos.x) < 0.1 && Math.abs(y - pos.y) < 0.1;
			})
			.addHandler(GestureType.Drag, this.handleDrag.bind(this));
	}

	private async handleDrag(gesture: DragGestureState) {
		const { x: x0, y: y0 } = this.position.get();
		const transform = this.transform.get();
		const { a: a0, b: b0, c: c0, d: d0 } = transform;
		const canvasToSelection = transform.inverse();

		const l = (x0 * x0) + (y0 * y0);

		const cx = (x0 || 1) / l;
		const cy = (y0 || 1) / l;

		for await (const p of gesture.points) {
			const { x: x1, y: y1 } = canvasToSelection.transformPoint(p);
			const f = (y1 * cy) + (x1 * cx);
			logger.debug("f: ", f);
			this.transform.updateBy(m => {
				if (this.offset.x) {
					m.a = f * a0;
					m.b = f * b0;
				}
				if (this.offset.y) {
					m.c = f * c0;
					m.d = f * d0;
				}
				return m;
			});
		}
	}
}

class RotateHandle extends HandleBase {
	private gestureFilter: FilterHandle;

	public constructor(
		ctx: CanvasContext,
		target: SVGElement,
		private transform: MutableState<DOMMatrix>,
		size: State<Point>,
		private offset: Point,
	) {
		super(
			target.createChild("circle")
				.addClasses("selection-handle")
				.setAttrs({
					cx: 0,
					cy: 0,
					r: 0.1,
				}),
			transform,
			size,
			offset,
		);

		this.gestureFilter = ctx.createGestureFilter(GestureLayer.Highest)
			.setTest(({ x, y }) => {
				const pos = this.canvasPos.get();
				return Math.abs(x - pos.x) < 0.1 && Math.abs(y - pos.y) < 0.1;
			})
			.addHandler(GestureType.Drag, this.handleDrag.bind(this));
	}

	private async handleDrag(gesture: DragGestureState) {
		const { x: x0, y: y0 } = this.position.get();
		const targetAngle = Math.atan2(y0, x0);
		const transform = this.transform.getSnapshot();
		const reverseTransform = transform.inverse();

		const identity = new DOMMatrix();

		for await (const p of gesture.points.map(p => reverseTransform.transformPoint(p))) {
			const cursorAngle = Math.atan2(p.y, p.x);

			const angleDiff = rad2deg(cursorAngle - targetAngle);

			const newVal = identity.rotate(angleDiff);

			newVal.multiplySelf(transform);

			newVal.e = transform.e;
			newVal.f = transform.f;

			this.transform.set(newVal);
		}
	}
}