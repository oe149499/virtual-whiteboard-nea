// import { Logger } from "../Logger.js";
// import { ClientID, ItemID, Point, Transform } from "../gen/Types.js";
// import { MutableState, State, mutableStateOf } from "../util/State.js";
// import { None, point, rad2deg } from "../util/Utils.js";
// import { asDomMatrix } from "../Transform.js";
// import { CanvasContext, MatrixHelper, TranslateHelper } from "./CanvasBase.js";
// import { DragGestureState, FilterHandle, GestureLayer, GestureType } from "./Gesture.js";
// import { BoardTable, type SelectionInit } from "./ItemTable.js";
// import { fromMatrix, updateMatrix } from "../Transform.js";
// import { MArgs } from "../GenWrapper.js";
// const logger = new Logger("canvas/SelectionBox");

// export class SelectionBoxBase {
// 	protected container: SVGGElement;
// 	private itemHolder: SVGGElement;

// 	protected selectionTransform = mutableStateOf(new DOMMatrix());
// 	protected reverseMatrix = this.selectionTransform.derivedI("inverse");

// 	protected selectionSize = mutableStateOf(point(1, 1));

// 	protected itemContainer: SVGGElement;

// 	protected heldItems = new Set<ItemID>();

// 	private containerTransform: MatrixHelper;
// 	private outline: BorderOutline;

// 	public constructor(
// 		protected ctx: CanvasContext,
// 		protected items: BoardTable,
// 		init: SelectionInit,
// 	) {
// 		const { transform, items: itemTransforms } = init;
// 		this.selectionTransform.updateBy(m => updateMatrix(m, transform));

// 		this.container = ctx.createRootElement("g");
// 		this.itemContainer = this.container.createChild("g");
// 		this.itemHolder = this.itemContainer.createChild("g");


// 		for (const [numId, item] of Object.entries(itemTransforms)) {
// 			const id = Number(numId);
// 			this.heldItems.add(id);
// 			const cont = this.itemHolder.createChild("g");

// 			const transform = ctx.createTransform();
// 			updateMatrix(transform.matrix, item);
// 			cont.transform.baseVal.appendItem(transform);


// 			const entry = items.get(id);
// 			if (entry === None) continue;
// 			const { canvasItem } = entry;
// 			cont.append(canvasItem.element);
// 		}

// 		const bounds = this.itemContainer.getBBox();
// 		this.selectionSize.set({
// 			x: bounds.width,
// 			y: bounds.height,
// 		});

// 		this.containerTransform = new MatrixHelper(this.itemContainer.transform.baseVal, this.selectionTransform);

// 		this.outline = new BorderOutline(
// 			ctx,
// 			this.container,
// 			this.selectionTransform,
// 			this.selectionSize,
// 		);
// 	}

// 	protected addItem(ids: ItemID[], collect: false): void;
// 	protected addItem(ids: ItemID[], collect: true): MArgs<"SelectionAddItems">;
// 	protected addItem(ids: ItemID[], collect: boolean) {
// 		const newItemHolder = this.container.createChild("g");
// 		//newItemHolder.style.visibility = "hidden";

// 		const newIds = new Set(ids);
// 		this.heldItems.addFrom(newIds);

// 		const matrices = new Map<ItemID, DOMMatrix>();

// 		for (const entry of this.items.get(this.heldItems)) {
// 			if (entry === None) continue;
// 			const { canvasItem: item, id } = entry;

// 			const matrix = item.element.getFinalTransform();
// 			const cont = newItemHolder.createChild("g");

// 			const transform = this.ctx.createTransform(matrix);
// 			cont.transform.baseVal.appendItem(transform);
// 			matrices.set(id, transform.matrix);

// 			cont.appendChild(item.element);
// 		}

// 		const bounds = newItemHolder.getBBox();

// 		logger.debug("bounds: ", bounds);

// 		const center = {
// 			x: (bounds.left + bounds.right) / 2,
// 			y: (bounds.top + bounds.bottom) / 2,
// 		};

// 		const newTransforms = [] as [ItemID, Transform][];
// 		const oldTransforms = [] as [ItemID, Transform][];

// 		for (const [id, matrix] of matrices.entries()) {
// 			matrix.e -= center.x;
// 			matrix.f -= center.y;
// 			if (collect) {
// 				const transform = fromMatrix(matrix);
// 				if (newIds.has(id)) newTransforms.push([id, transform]);
// 				else oldTransforms.push([id, transform]);
// 			}
// 		}

// 		// const holderTransform = this.ctx.createTransform();
// 		// holderTransform.setTranslate(-center.x, -center.y);
// 		// newItemHolder.transform.baseVal.appendItem(holderTransform);

// 		this.itemContainer.appendChild(newItemHolder);

// 		this.itemHolder.remove();
// 		this.itemHolder = newItemHolder;

// 		this.selectionSize.set({ x: bounds.width, y: bounds.height });

// 		const transform = {
// 			origin: center,
// 			basisX: point(1, 0),
// 			basisY: point(0, 1),
// 		};

// 		this.selectionTransform.set(asDomMatrix(transform));
// 		newItemHolder.style.visibility = "initial";

// 		if (collect) {
// 			const payload: MArgs<"SelectionAddItems"> = {
// 				selectionTransform: transform,
// 				newItems: newTransforms,
// 				existingItems: oldTransforms,
// 			};
// 			return payload;
// 		}

// 		return undefined;
// 	}

// 	public updateTransform(newTransform: Transform) {
// 		this.selectionTransform.updateBy(t => updateMatrix(t, newTransform));
// 	}
// }

// export class UserSelection extends SelectionBoxBase {
// 	private gestureFilter: FilterHandle;

// 	private border: BorderHandles;

// 	constructor(ctx: CanvasContext, items: BoardTable, init: SelectionInit) {
// 		super(ctx, items, init);

// 		let addingItems = false;

// 		this.border = new BorderHandles(ctx, this.container, this.selectionTransform, this.selectionSize);

// 		this.items.events.ownSelectionAdd.bind(items => {
// 			addingItems = true;
// 			const result = this.addItem(items, true);
// 			queueMicrotask(() => addingItems = false);
// 			return result;
// 		});

// 		this.gestureFilter = ctx.createGestureFilter(GestureLayer.AboveItems)
// 			.addHandler(GestureType.Drag, this.handleGesture.bind(this))
// 			.setTest((p) => {
// 				const { x, y } = this.reverseMatrix.get().transformPoint(p);
// 				const s = this.selectionSize.get();
// 				return Math.abs(x) < s.x / 2 && Math.abs(y) < s.y / 2;
// 			});

// 		this.selectionTransform.watch(m => {
// 			if (!addingItems) items.moveOwnSelection(fromMatrix(m));
// 		});
// 	}

// 	public testIntersection(p: Point): boolean {
// 		logger.debug("Testing for point: ", p);
// 		const val = this.container.getBBox().testIntersection(p);
// 		logger.debug("result: ", val);
// 		return val;
// 	}

// 	public async handleGesture(gesture: DragGestureState) {
// 		const { e: startX, f: startY } = this.selectionTransform.get();
// 		const ox = startX - gesture.location.x;
// 		const oy = startY - gesture.location.y;

// 		for await (const { x, y } of gesture.points) {
// 			//logger.debug("Point: ", x, y);
// 			this.selectionTransform.updateBy(t => {
// 				t.e = x + ox;
// 				t.f = y + oy;
// 				return t;
// 			});
// 			//logger.debug("", this.selectionTransform.get());
// 		}
// 	}
// }

// export class RemoteSelection extends SelectionBoxBase {
// 	constructor(ctx: CanvasContext, items: BoardTable, init: SelectionInit) {
// 		super(ctx, items, init);

// 		items.events.selection.register(init.id, {
// 			add: (items) => this.addItem(items.map(({ id }) => id), false),
// 			move: t => this.selectionTransform.updateBy(m => updateMatrix(m, t)),
// 		});
// 	}
// }

// const dirs = [
// 	[-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1],
// ].map(([x, y]) => point(x / 2, y / 2));

// const cornerDirs = [
// 	[-1, -1], [-1, 1], [1, 1], [1, -1],
// ].map(([x, y]) => point(x / 2, y / 2));

// const rotateDir = point(0, -0.75);

// class BorderOutline {
// 	#keepalive: unknown[] = [];

// 	public readonly element: SVGPolygonElement;
// 	public constructor(
// 		ctx: CanvasContext,
// 		target: SVGElement,
// 		transform: State<DOMMatrix>,
// 		size: State<Point>,
// 	) {
// 		const element = target.createChild("polygon").addClasses("selection");
// 		this.element = element;

// 		const list = element.points;

// 		const points = cornerDirs.map(p => (size
// 			.derived(s => ({
// 				x: s.x * p.x,
// 				y: s.y * p.y,
// 			}))
// 			.with(transform)
// 			.derivedT((s, t) => t.transformPoint(s))
// 		));

// 		for (const [idx, point] of points.entries()) {
// 			list.appendItem(ctx.createPoint(point.get()));
// 			const handle = ctx.createPointBy(point).watch(
// 				p => list.replaceItem(p, idx),
// 			);
// 			this.#keepalive.push(handle);
// 		}
// 	}
// }

// class BorderHandles {
// 	#keepalive = [] as unknown[];
// 	// public readonly element: SVGPolygonElement;
// 	private handles: StretchHandle[];
// 	private rotateHandle: RotateHandle;

// 	public constructor(
// 		ctx: CanvasContext,
// 		target: SVGElement,
// 		transform: MutableState<DOMMatrix>,
// 		size: MutableState<Point>,
// 	) {
// 		this.handles = dirs.map(offset => new StretchHandle(
// 			ctx,
// 			target,
// 			transform,
// 			size,
// 			offset,
// 		));

// 		this.rotateHandle = new RotateHandle(
// 			ctx,
// 			target,
// 			transform,
// 			size,
// 			rotateDir,
// 		);
// 	}
// }

// abstract class HandleBase {
// 	private translate: TranslateHelper;
// 	protected position: State<Point>;
// 	protected canvasPos: State<Point>;

// 	protected constructor(
// 		private elem: SVGGraphicsElement,
// 		transform: State<DOMMatrix>,
// 		size: State<Point>,
// 		offset: Point,
// 	) {
// 		this.position = size
// 			.derived(({ x, y }) => ({ x: x * offset.x, y: y * offset.y }));

// 		this.canvasPos = this.position
// 			.with(transform)
// 			.derivedT((p, t) => t.transformPoint(p));

// 		this.translate = new TranslateHelper(elem.transform.baseVal, this.canvasPos);
// 	}
// }

// class StretchHandle extends HandleBase {
// 	private gestureFilter: FilterHandle;

// 	public constructor(
// 		ctx: CanvasContext,
// 		target: SVGElement,
// 		private transform: MutableState<DOMMatrix>,
// 		size: State<Point>,
// 		private offset: Point,
// 	) {
// 		super(
// 			target.createChild("rect")
// 				.addClasses("selection-handle")
// 				.setAttrs({
// 					x: -0.1,
// 					y: -0.1,
// 					width: 0.2,
// 					height: 0.2,
// 				}),
// 			transform,
// 			size,
// 			offset,
// 		);

// 		this.gestureFilter = ctx.createGestureFilter(GestureLayer.Highest)
// 			.setTest(({ x, y }) => {
// 				const pos = this.canvasPos.get();
// 				return Math.abs(x - pos.x) < 0.1 && Math.abs(y - pos.y) < 0.1;
// 			})
// 			.addHandler(GestureType.Drag, this.handleDrag.bind(this));
// 	}

// 	private async handleDrag(gesture: DragGestureState) {
// 		const { x: x0, y: y0 } = this.position.get();
// 		const transform = this.transform.get();
// 		const { a: a0, b: b0, c: c0, d: d0 } = transform;
// 		const canvasToSelection = transform.inverse();

// 		const l = (x0 * x0) + (y0 * y0);

// 		const cx = (x0 || 1) / l;
// 		const cy = (y0 || 1) / l;

// 		for await (const p of gesture.points) {
// 			const { x: x1, y: y1 } = canvasToSelection.transformPoint(p);
// 			const f = (y1 * cy) + (x1 * cx);
// 			logger.debug("f: ", f);
// 			this.transform.updateBy(m => {
// 				if (this.offset.x) {
// 					m.a = f * a0;
// 					m.b = f * b0;
// 				}
// 				if (this.offset.y) {
// 					m.c = f * c0;
// 					m.d = f * d0;
// 				}
// 				return m;
// 			});
// 		}
// 	}
// }

// class RotateHandle extends HandleBase {
// 	private gestureFilter: FilterHandle;

// 	public constructor(
// 		ctx: CanvasContext,
// 		target: SVGElement,
// 		private transform: MutableState<DOMMatrix>,
// 		size: State<Point>,
// 		private offset: Point,
// 	) {
// 		super(
// 			target.createChild("circle")
// 				.addClasses("selection-handle")
// 				.setAttrs({
// 					cx: 0,
// 					cy: 0,
// 					r: 0.1,
// 				}),
// 			transform,
// 			size,
// 			offset,
// 		);

// 		this.gestureFilter = ctx.createGestureFilter(GestureLayer.Highest)
// 			.setTest(({ x, y }) => {
// 				const pos = this.canvasPos.get();
// 				return Math.abs(x - pos.x) < 0.1 && Math.abs(y - pos.y) < 0.1;
// 			})
// 			.addHandler(GestureType.Drag, this.handleDrag.bind(this));
// 	}

// 	private async handleDrag(gesture: DragGestureState) {
// 		const { x: x0, y: y0 } = this.position.get();
// 		const targetAngle = Math.atan2(y0, x0);
// 		const transform = this.transform.getSnapshot();
// 		const reverseTransform = transform.inverse();

// 		const identity = new DOMMatrix();

// 		for await (const p of gesture.points.map(p => reverseTransform.transformPoint(p))) {
// 			const cursorAngle = Math.atan2(p.y, p.x);

// 			const angleDiff = rad2deg(cursorAngle - targetAngle);

// 			const newVal = identity.rotate(angleDiff);

// 			newVal.multiplySelf(transform);

// 			newVal.e = transform.e;
// 			newVal.f = transform.f;

// 			this.transform.set(newVal);
// 		}
// 	}
// }