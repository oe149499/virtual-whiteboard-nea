import { Logger } from "../Logger.js";
import { ItemID, Point, Transform } from "../gen/Types.js";
import { MutableState, State, collectStateOf, mutableStateOf } from "../util/State.js";
import { None, Option, applyTransform, asDomMatrix, point } from "../util/Utils.js";
import { CanvasContext, TransformHelper } from "./CanvasBase.js";
import { CanvasItem } from "./CanvasItems.js";
import { Gesture, GestureType } from "./Gesture.js";
const logger = new Logger("canvas/SelectionBox");

export class SelectionBox {
	private container: SVGGElement;

	private selectionTransform: MutableState<Transform> = mutableStateOf({
		origin: point(),
		basisX: point(1, 0),
		basisY: point(0, 1),
	});

	private selectionSize = mutableStateOf(point(1, 1));

	private selectionMatrix = asDomMatrix(this.selectionTransform);

	private containerTransform: TransformHelper;

	private items = new Map<ItemID, CanvasItem>();

	private border: BorderBox;
	private itemContainer: SVGGElement;

	constructor(private ctx: CanvasContext) {
		this.container = ctx.createRootElement("g");

		this.border = new BorderBox(ctx, this.container, this.selectionMatrix, this.selectionSize);

		this.itemContainer = this.container.createChild("g");

		this.containerTransform = new TransformHelper(ctx, this.itemContainer.transform.baseVal, this.selectionTransform);

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

		this.selectionTransform.set({
			origin: center,
			basisX: point(1, 0),
			basisY: point(0, 1),
		});
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

	public async handleGesture(gesture: Gesture) {
		logger.debug("Beginning gesture: %o", gesture);
		if (gesture.type == GestureType.Drag) {
			const start = this.selectionTransform.getSnapshot().origin;
			const ox = start.x - gesture.location.x;
			const oy = start.y - gesture.location.y;

			for await (const { x, y } of gesture.points) {
				logger.debug("Point: ", x, y);
				this.selectionTransform.updateBy(t => {
					t.origin = {
						x: x + ox,
						y: y + oy,
					};
					return t;
				});
				logger.debug("", this.selectionTransform.get());
			}
		}
	}
}

const dirs = [
	point(-1, -1),
	point(-1, +1),
	point(+1, +1),
	point(+1, -1),
];

class BorderBox {
	public readonly element: SVGPolygonElement;
	private handles: BorderHandle[];
	keepalive?: unknown[];

	public constructor(
		ctx: CanvasContext,
		target: SVGElement,
		transform: State<DOMMatrixReadOnly>,
		size: State<Point>,
	) {
		const element = target.createChild("polygon").addClasses("selection");

		const vertices: State<Point>[] = dirs.map(({ x: sx, y: sy }) =>
			size.derived(({ x, y }) => point(x * sx / 2, y * sy / 2))
		);
		this.keepalive = vertices;

		const points = vertices
			.map(p => ctx
				.createPointBy(p)
				.with(transform)
				.debug(logger, "Tuple state: ")
				.derivedT((s, t) =>
					t.transformPoint(s)
				)
			)
			.map(ctx.createPointBy);

		this.element = element;
		logger.debug("", points);
		this.handles = [];
		for (const [idx, p] of points.entries()) {
			this.handles.push(new BorderHandle(ctx, p, target));
			this.keepalive.push(p);
			logger.debug('"point": ', p.get());
			element.points.appendItem(p.get());
			const handle = p.watch(p => {
				logger.debug("point: ", p);
				element.points.replaceItem(p, idx);
			});
			this.keepalive.push(handle);
		}
	}
}

class BorderHandle {
	private transform: TransformHelper;
	public constructor(
		ctx: CanvasContext,
		private position: State<Point>,
		target: SVGElement,
	) {
		const elem = target.createChild("rect")
			.addClasses("selection-handle")
			.setAttrs({
				x: -0.1,
				y: -0.1,
				width: 0.2,
				height: 0.2,
			});
		this.transform = new TransformHelper(ctx, elem.transform.baseVal, collectStateOf({
			origin: position,
			basisX: point(1, 0),
			basisY: point(0, 1),
		}));
	}
}