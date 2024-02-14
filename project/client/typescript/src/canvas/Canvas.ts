import { Logger } from "../Logger.js";
import { ClientID, Item, ItemID, Point } from "../gen/Types.js";
import { Channel, makeChannel } from "../util/Channel.js";
import { MutableState, State, mutableStateOf, stateBy } from "../util/State.js";
import { CanvasContext, CoordinateMapping, SVGNS } from "./CanvasBase.js";
import { CanvasItem } from "./items/CanvasItems.js";
import "./items/ItemBuilders.js";
import { DragGestureState, GestureHandler, LongPressGesture, PressGesture } from "./Gesture.js";
import { BoardTable } from "./ItemTable.js";
import { TimeoutMap } from "../util/TimeoutMap.js";
import { LocalSelection, RemoteSelection } from "./Selection.js";


const PX_PER_CM = 37.8;
const logger = new Logger("canvas/CanvasController");

export class CanvasController {
	public readonly svgElement: SVGSVGElement;
	public readonly ctx: CanvasContext;
	// public readonly selection = new Map<ClientID, UserSelection>();

	private targetRect: DOMRect;

	public readonly elementBounds: State<DOMRectReadOnly>;

	private activeGestures: { [key: number]: { move: Channel<PointerEvent>, end: (_: PointerEvent) => void } } = {};
	private gestures!: GestureHandler;
	private coordMapping: MutableState<CoordinateMapping>;

	private cursorTimeouts = new TimeoutMap(1000, (id: number) => {
		this.currentCursors.mutate(c => c.delete(id));
	});

	private currentCursors = mutableStateOf(new Set());
	public readonly isGesture = this.currentCursors.derived(s => s.size !== 0);

	public ondraggesture: Handler<DragGestureState> = null;
	public onpressgesture: Handler<PressGesture> = null;
	public onlongpressgesture: Handler<LongPressGesture> = null;

	constructor(public readonly itemTable: BoardTable) {
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
		itemTable.events.remoteSelectionCreate.bind(init => {
			return new RemoteSelection(this.ctx, itemTable, init);
			// return null as unknown as never;
		});
		itemTable.events.ownSelectionCreate.bind(() => new LocalSelection(this.ctx, itemTable));

		svgElement.setAttribute("viewBox", "0 0 0 0");
		this.targetRect = svgElement.viewBox.baseVal;

		this.elementBounds = stateBy(
			new DOMRect(),
			set => new ResizeObserver(([{ contentRect }]) => set(contentRect)).observe(svgElement),
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
		}
	}

	/** @deprecated */
	public addItem(id: ItemID, item: Item) {
		this.itemTable.addItem(id, item);
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
		this.coordMapping.updateBy(m => {
			m.targetOffset = { x, y };
			return m;
		});
	}

	private pointerDown(e: PointerEvent): void {
		this.currentCursors.mutate(s => s.add(e.pointerId));
		this.cursorTimeouts.add(e.pointerId);

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

		this.currentCursors.mutate(c => c.delete(e.pointerId));
		this.cursorTimeouts.clear(e.pointerId);

		this.activeGestures[e.pointerId].move.close();
		this.activeGestures[e.pointerId].end(e);
		delete this.activeGestures[e.pointerId];
	}

	private pointerMove(e: PointerEvent): void {
		if (!(e.pointerId in this.activeGestures)) return;
		const id = e.pointerId;

		this.cursorTimeouts.push(id);

		const gesture = this.activeGestures[id];
		if (!gesture) return;

		gesture.move.push(e);
	}
}