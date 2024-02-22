import { Logger } from "../Logger.js";
import { Item, ItemID, Point } from "../gen/Types.js";
import { Channel, makeChannel } from "../util/Channel.js";
import { MutableState, State, mutableStateOf, stateBy } from "../util/State.js";
import { CanvasContext, CoordinateMapping, SVGNS } from "./CanvasBase.js";
import { CanvasItem, ItemPropertyStore } from "./items/CanvasItems.js";
import "./items/ItemBuilders.js";
import { GestureHandler } from "./Gesture.js";
import { BoardTable, type ItemEntry } from "../BoardTable.js";
import { TimeoutMap } from "../util/TimeoutMap.js";
import { LocalSelection, RemoteSelection } from "./Selection.js";
import type { PropertyInstance } from "../Properties.js";
import { None, point } from "../util/Utils.js";


const PX_PER_CM = 37.8;
const logger = new Logger("canvas/CanvasController");

export class CanvasController {
	public readonly svgElement = document.createElementNS(SVGNS, "svg")
		.setAttrs({
			viewBox: "0 0 0 0",
		})
		.addHandlers({
			pointerdown: this.pointerDown.bind(this),
			pointerup: this.pointerUp.bind(this),
			pointermove: this.pointerMove.bind(this),
		});

	public readonly ctx: CanvasContext;
	// public readonly selection = new Map<ClientID, UserSelection>();

	private targetRect = this.svgElement.viewBox.baseVal;

	public readonly elementBounds = stateBy(
		new DOMRect(),
		set => new ResizeObserver(
			entries => set(entries[0].contentRect),
		).observe(this.svgElement),
	);

	private activeGestures: { [key: number]: { move: Channel<PointerEvent>, end: (_: PointerEvent) => void } } = {};
	private gestures!: GestureHandler;
	private coordMapping = mutableStateOf<CoordinateMapping>({
		screenOrigin: { x: 0, y: 0 },
		stretch: PX_PER_CM,
		targetOffset: { x: 0, y: 0 },
	});

	private cursorTimeouts = new TimeoutMap(1000, (id: number) => {
		this.currentCursors.mutate(c => c.delete(id));
	});

	private currentCursors = mutableStateOf(new Set());
	public readonly isGesture = this.currentCursors.derived(s => s.size !== 0);

	private cursorPos = mutableStateOf(point());

	public readonly propertyStore: ItemPropertyStore;

	constructor(public readonly boardTable: BoardTable) {
		const svgElement = this.svgElement;

		this.ctx = new CanvasContext(this.svgElement, this.coordMapping, boardTable, {
			cursorPos: this.cursorPos,
			exec: ({ gestures: g }) => this.gestures = g,
		});
		//  ({ gestures }) => {
		// 	this.gestures = gestures;
		// });

		this.propertyStore = new ItemPropertyStore(boardTable);

		boardTable.events.items.connect("insert", ({ canvasItem }) => {
			svgElement.appendChild(canvasItem.element);
		});

		boardTable.events.items.connect("deselect", ({ canvasItem }) => {
			logger.debug("Deselecting item");
			svgElement.appendChild(canvasItem.element);
		});

		boardTable.events.itemCreate.bind(item => CanvasItem.create(this.ctx, item));
		boardTable.events.remoteSelectionCreate.bind(init => {
			return new RemoteSelection(this.ctx, boardTable, init);
			// return null as unknown as never;
		});
		boardTable.events.ownSelectionCreate.bind((...args) => {
			if (args.length) {
				const [srt, items] = args;
				return new LocalSelection(this.ctx, boardTable, { srt, items });
			} else return new LocalSelection(this.ctx, boardTable);
		});

		this.elementBounds.watch(({ x, y, width, height }) => {
			this.coordMapping.updateBy(m => (
				m.screenOrigin = { x, y }, m
			));
			this.targetRect.width = width / PX_PER_CM;
			this.targetRect.height = height / PX_PER_CM;
		});

		// svgElement.onpointerdown = this.pointerDown.bind(this);
		// svgElement.onpointermove = this.pointerMove.bind(this);
		// svgElement.onpointerup = this.pointerUp.bind(this);
	}

	public * probePoint(target: Point): Iterable<ItemEntry> {
		for (const entry of this.boardTable.entries()) {
			if (entry.selection !== None) continue;
			logger.debug("bounds: ", entry.canvasItem.bounds);
			if (entry.canvasItem.bounds.testIntersection(target)) yield entry;
		}
	}

	/** @deprecated */
	public addItem(id: ItemID, item: Item) {
		this.boardTable.addItem(id, item);
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

	public getPropertyInstance(entry: ItemEntry): PropertyInstance {
		const schema = CanvasItem.schemaFor(entry.canvasItem, this.propertyStore);
		this.propertyStore.bind(entry.id);
		return { schema, store: this.propertyStore };
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
		this.cursorPos.set(point(e.x, e.y));
		if (!(e.pointerId in this.activeGestures)) return;
		const id = e.pointerId;

		this.cursorTimeouts.push(id);

		const gesture = this.activeGestures[id];
		if (!gesture) return;

		gesture.move.push(e);
	}
}