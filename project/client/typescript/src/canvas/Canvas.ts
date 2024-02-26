import { Logger } from "../Logger.js";
import { Item, ItemID, Point } from "../gen/Types.js";
import { Channel, makeChannel } from "../util/Channel.js";
import { MutableState, State, mutableStateOf, stateBy } from "../util/State.js";
import { CanvasContext, CoordinateMapping, SVGNS } from "./CanvasBase.js";
import { CanvasItem, FillItem, ItemPropertyStore, StrokeItem } from "./items/CanvasItems.js";
import "./items/ItemBuilders.js";
import { GestureHandler } from "./Gesture.js";
import { BoardTable, type ItemEntry } from "../BoardTable.js";
import { TimeoutMap } from "../util/TimeoutMap.js";
import { LocalSelection, RemoteSelection } from "./Selection.js";
import type { PropertyInstance, PropertySchema } from "../Properties.js";
import { None, anyOf, instanceOf, point } from "../util/Utils.js";


const PX_PER_CM = 37.8;
const logger = new Logger("canvas/CanvasController");

export class CanvasController {
	private gestures!: GestureHandler;

	private coordMapping = mutableStateOf<CoordinateMapping>({
		screenOrigin: { x: 0, y: 0 },
		stretch: PX_PER_CM * 1.5,
		targetOffset: { x: 0, y: 0 },
	});

	private cursorPos = mutableStateOf(point());

	#svg!: SVGSVGElement;
	public readonly ctx = new CanvasContext(this.coordMapping, {
		exec: ({ gestures, svg }) => {
			this.gestures = gestures;
			this.#svg = svg;
		},
		cursorPos: this.cursorPos,
	});

	public readonly svgElement = this.#svg
		.setAttrs({
			viewBox: "0 0 0 0",
		})
		.addHandlers({
			pointerdown: this.pointerDown.bind(this),
			pointerup: this.pointerUp.bind(this),
			pointermove: this.pointerMove.bind(this),
		});

	private targetRect = this.svgElement.viewBox.baseVal;

	public readonly elementBounds = stateBy(
		new DOMRect(),
		set => new ResizeObserver(
			entries => set(entries[0].contentRect),
		).observe(this.svgElement),
	);

	private activeGestures: { [key: number]: { move: Channel<PointerEvent>, end: (_: PointerEvent) => void } } = {};

	private cursorTimeouts = new TimeoutMap(1000, (id: number) => {
		this.currentCursors.mutate(c => c.delete(id));
	});

	private currentCursors = mutableStateOf(new Set());
	public readonly isGesture = this.currentCursors.derived(s => s.size !== 0);

	public readonly propertyStore: ItemPropertyStore;

	constructor(public readonly boardTable: BoardTable) {
		const ctx = this.ctx;

		this.propertyStore = new ItemPropertyStore(boardTable);

		boardTable.events.items.connect("insert", ({ canvasItem }) => {
			ctx.insertScaled(canvasItem.element);
			CanvasItem.schemaFor(canvasItem, this.propertyStore);
		});

		boardTable.events.items.connect("deselect", ({ canvasItem: { element } }) => ctx.insertScaled(element));

		boardTable.events.itemCreate.bind(item => CanvasItem.create(ctx, item));
		boardTable.events.remoteSelectionCreate.bind(init => {
			return new RemoteSelection(ctx, boardTable, init);
		});
		boardTable.events.ownSelectionCreate.bind((...args) => {
			if (args.length) {
				const [srt, items] = args;
				return new LocalSelection(ctx, boardTable, { srt, items });
			} else return new LocalSelection(ctx, boardTable);
		});

		this.elementBounds.watch(({ x, y, width, height }) => {
			this.coordMapping.mutate(m => m.screenOrigin = { x, y });
			this.targetRect.width = width;
			this.targetRect.height = height;
		});
	}

	public * probePoint(target: Point): Iterable<ItemEntry> {
		for (const entry of this.boardTable.entries()) {
			if (entry.selection !== None) continue;
			logger.debug("bounds: ", entry.canvasItem.bounds);
			if (entry.canvasItem.bounds.testIntersection(target)) yield entry;
		}
	}

	public addRawElement(elem: SVGElement) {
		this.svgElement.appendChild(elem);
	}

	public readonly origin = this.coordMapping.extract("targetOffset");
	public readonly zoom = this.coordMapping.extract("stretch");


	public getPropertyInstance(entries: ReadonlySet<ItemEntry>): PropertyInstance {
		let schema: PropertySchema[] = [];

		if (entries.size === 1) for (const { canvasItem } of entries) {
			schema = CanvasItem.schemaFor(canvasItem, this.propertyStore);
		} else if (anyOf(entries, ({ canvasItem }) => canvasItem instanceof FillItem)) {
			schema = FillItem.schema;
		} else if (anyOf(entries, ({ canvasItem }) => canvasItem instanceof StrokeItem)) {
			schema = StrokeItem.schema;
		}

		logger.debug("Schema for %o is %o", entries, schema);

		this.propertyStore.bindEntries(entries);
		return { schema, store: this.propertyStore };
	}

	private pointerDown(e: PointerEvent): void {
		this.cursorPos.set(point(e.x, e.y));
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

		e.preventDefault();
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
		e.stopPropagation();
	}
}