import { Logger } from "../Logger.js";
import { ClientID, Item, ItemID, Point } from "../gen/Types.js";
import { Channel, makeChannel } from "../util/Channel.js";
import { MutableState, State, mutableStateOf, stateBy } from "../util/State.js";
import { CanvasContext, CoordinateMapping, SVGNS } from "./CanvasBase.js";
import { CanvasItem } from "./items/CanvasItems.js";
import "./items/ItemBuilders.js";
import { DragGestureState, Gesture, GestureHandler, GestureType, LongPressGesture, PressGesture } from "./Gesture.js";
import { RemoteSelection, UserSelection } from "./SelectionBox.js";
import { ItemTable } from "./ItemTable.js";


const PX_PER_CM = 37.8;
const logger = new Logger("canvas/CanvasController");

export class CanvasController {
	public readonly svgElement: SVGSVGElement;
	public readonly ctx: CanvasContext;
	public readonly selection = new Map<ClientID, UserSelection>();

	private items = new Map<ItemID, CanvasItem>();
	// public readonly itemTable: ItemTable;

	private targetRect: DOMRect;

	public readonly elementBounds: State<DOMRectReadOnly>;

	private activeGestures: { [key: number]: { move: Channel<PointerEvent>, end: (_: PointerEvent) => void } } = {};
	private gestures!: GestureHandler;
	private coordMapping: MutableState<CoordinateMapping>;

	private gestureCount = mutableStateOf(0);
	public readonly isGesture = this.gestureCount.derived(c => c !== 0);

	public ondraggesture: Handler<DragGestureState> = null;
	public onpressgesture: Handler<PressGesture> = null;
	public onlongpressgesture: Handler<LongPressGesture> = null;

	constructor(public readonly itemTable: ItemTable) {
		const svgElement = document.createElementNS(SVGNS, "svg");
		this.svgElement = svgElement;

		this.coordMapping = mutableStateOf({
			screenOrigin: { x: 0, y: 0 },
			stretch: PX_PER_CM,
			targetOffset: { x: 0, y: 0 },
		});

		this.ctx = new CanvasContext(this.svgElement, this.coordMapping, itemTable, ({ gestures }) => {
			this.gestures = gestures;
		});

		itemTable.events.items.connect("insert", ({ canvasItem }) => {
			svgElement.appendChild(canvasItem.element);
		});

		itemTable.events.itemCreate.bind(item => CanvasItem.create(this.ctx, item));
		itemTable.events.selectionCreate.bind(id => {
			if (id === itemTable.ownID) return new UserSelection(this.ctx, itemTable);
			else return new RemoteSelection(this.ctx, itemTable, id);
		});

		// this.itemTable = new ItemTable(
		// 	CanvasItem.create.bind(null, this.ctx),
		// 	{
		// 		onInsert: ({ canvasItem }) => {
		// 			svgElement.appendChild(canvasItem.element);
		// 		},
		// 	},
		// );

		// this.selection = new SelectionBox(this.ctx, this.itemTable);

		svgElement.setAttribute("viewBox", "0 0 0 0");
		this.targetRect = svgElement.viewBox.baseVal;

		this.elementBounds = stateBy(
			new DOMRect(),
			set => new ResizeObserver((e) => set(e[0].contentRect)).observe(svgElement),
		);

		this.elementBounds.watch(({ x, y, width, height }) => {
			this.coordMapping.updateBy(m => (
				m.screenOrigin = { x, y }, m
			));
			this.targetRect.width = width / PX_PER_CM;
			this.targetRect.height = height / PX_PER_CM;
		});

		svgElement.onpointerdown = this.pointerDown.bind(this);
		svgElement.onpointermove = this.pointerMove.bind(this);
		svgElement.onpointerup = this.pointerUp.bind(this);
	}

	public * probePoint(target: Point) {
		for (const { id, canvasItem: item } of this.itemTable.entries()) {
			if (item.bounds.testIntersection(target)) yield { item, id };
			// logger.debug("Bounds: ", item.bounds);
		}
	}

	// private onGesture(gesture: Gesture): void {
	// 	if (this.selection.testIntersection(gesture.location)) {
	// 		this.selection.handleGesture(gesture);
	// 	} else switch (gesture.type) {
	// 		case GestureType.Drag: return this.ondraggesture?.(gesture);
	// 		case GestureType.Click: return this.onpressgesture?.(gesture);
	// 		case GestureType.LongClick: return this.onlongpressgesture?.(gesture);
	// 	}
	// }

	public addItem(id: ItemID, item: Item) {
		this.itemTable.insert(id, item);
		// const canvasItem = CanvasItem.create(this.ctx, item);
		// this.items.set(id, canvasItem);
		// this.svgElement.appendChild(canvasItem.element);
	}

	public addRawElement(elem: SVGElement) {
		this.svgElement.appendChild(elem);
	}

	public getOrigin() {
		return { x: this.targetRect.x, y: this.targetRect.y };
	}

	public setOrigin({ x, y }: { x: number, y: number }) {
		this.targetRect.x = x;
		this.targetRect.y = y;
		//logger.debug("Current target: %o", this.targetRect);
		this.coordMapping.updateBy(m => {
			m.targetOffset = { x, y };
			return m;
		});
	}

	private pointerDown(e: PointerEvent): void {
		logger.debug("Mouse down: %o", e);
		logger.debug("Gestures: %o", this.activeGestures);

		this.gestureCount.updateBy(c => c + 1);

		const [channel, receiver] = makeChannel<PointerEvent>();

		let endResolve!: (_: PointerEvent) => void;

		const endPromise = new Promise<PointerEvent>((res) => endResolve = res);

		const id = e.pointerId;
		const handle = {
			move: channel,
			end: endResolve,
		};

		this.activeGestures[id] = handle;
		this.gestures.processEvents({
			start: e,
			moves: receiver,
			end: endPromise,
		});
	}

	private pointerUp(e: PointerEvent): void {
		if (!(e.pointerId in this.activeGestures)) return;

		this.gestureCount.updateBy(c => c - 1);

		this.activeGestures[e.pointerId].move.close();
		this.activeGestures[e.pointerId].end(e);
		delete this.activeGestures[e.pointerId];
	}

	private pointerMove(e: PointerEvent): void {
		if (!(e.pointerId in this.activeGestures)) return;
		const id = e.pointerId;
		const gesture = this.activeGestures[id];
		if (!gesture) return;

		gesture.move.push(e);
	}
}