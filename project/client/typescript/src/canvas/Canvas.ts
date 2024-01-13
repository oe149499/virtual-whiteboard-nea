import { Logger } from "../Logger.js";
import { Item, ItemID } from "../gen/Types.js";
import { Channel } from "../util/Channel.js";
import { State, stateBy } from "../util/State.js";
import { CanvasContext, SVGNS } from "./CanvasBase.js";
import { CanvasItem } from "./CanvasItems.js";
import { DragGestureState, GestureHandler } from "./Gesture.js";
import { SelectionBox } from "./SelectionBox.js";


const PX_PER_CM = 37.8;
const logger = new Logger("canvas/CanvasController");

export class CanvasController {
	public readonly svgElement: SVGSVGElement;
	public readonly ctx: CanvasContext;
	public readonly selection: SelectionBox;
	private items = {} as { [x: ItemID]: CanvasItem };


	private start = { x: -1, y: -1 };

	private targetRect: DOMRect;
	private targetStart = { x: -1, y: -1 };

	public elementBounds: State<DOMRectReadOnly>;

	private activeGestures: { [key: number]: { move: Channel<PointerEvent>, end: (_: PointerEvent) => void } } = {};
	private gestures = new GestureHandler();

	public ondraggesture: null | ((_: DragGestureState) => void) = null;

	constructor() {
		const svgElement = document.createElementNS(SVGNS, "svg");
		this.svgElement = svgElement;

		this.ctx = new CanvasContext(this.svgElement);
		this.selection = new SelectionBox(this.ctx);


		svgElement.setAttribute("viewBox", "0 0 0 0");
		this.targetRect = svgElement.viewBox.baseVal;

		this.elementBounds = stateBy(new DOMRect(),
			set => new ResizeObserver((e) => set(e[0].contentRect)).observe(svgElement)
		);

		this.elementBounds.watch(({ width, height }) => {
			this.targetRect.width = width / PX_PER_CM;
			this.targetRect.height = height / PX_PER_CM;
		});

		svgElement.onpointerdown = this.pointerDown.bind(this);
		svgElement.onpointerup = this.pointerUp.bind(this);
	}

	public addItem(id: ItemID, item: Item) {
		const canvas_item = CanvasItem.create(this.ctx, item);
		this.items[id] = canvas_item;
		this.svgElement.appendChild(canvas_item.element);
	}

	public addRawElement(elem: SVGElement) {
		this.svgElement.appendChild(elem);
	}

	public translateCoordinate(x: number, y: number) {
		const bounds = this.elementBounds.get();

		const rx = x - bounds.x;
		const ry = y - bounds.y;

		return {
			x: this.targetRect.x + rx / PX_PER_CM,
			y: this.targetRect.y + ry / PX_PER_CM,
		};
	}

	public getOrigin() {
		return { x: this.targetRect.x, y: this.targetRect.y };
	}

	public setOrigin({ x, y }: { x: number, y: number }) {
		this.targetRect.x = x;
		this.targetRect.y = y;
	}

	private pointerDown(e: PointerEvent): void {
		logger.debug("Mouse down: %o", e);
		logger.debug("Gestures: %o", this.activeGestures);

		const channel = new Channel<PointerEvent>();

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
			moves: channel,
			end: endPromise,
		});

		this.svgElement.onpointermove = this.pointerMove.bind(this);
	}

	private pointerUp(e: PointerEvent): void {
		if (!(e.pointerId in this.activeGestures)) return;
		this.activeGestures[e.pointerId].move.close();
		this.activeGestures[e.pointerId].end(e);
		delete this.activeGestures[e.pointerId];
		this.svgElement.onpointermove = null;
	}

	private pointerMove(e: PointerEvent): void {
		if (!(e.pointerId in this.activeGestures)) return;
		const id = e.pointerId;
		const gesture = this.activeGestures[id];
		if (!gesture) return;

		gesture.move.push(e);
	}
}