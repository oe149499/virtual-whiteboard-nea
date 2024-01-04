import { Logger } from "../Logger.js";
import { Point } from "../gen/Types.js";
import { Channel } from "../util/Channel.js";

const PX_PER_CM = 37.8;
const logger = new Logger("ui/CanvasView");

function waitForTree(n: Node, _parent?: Node): Promise<void> {
	const parent = _parent ?? document;
	return new Promise((resolve) => {
		const observer = new MutationObserver(() => {
			if (parent?.contains(n)) {
				resolve();
				observer.disconnect();
			}
		});
		observer.observe(parent, {
			subtree: true,
			childList: true,
		});
	});
}

export type DragGestureState = {
	initialOrigin: Point,
	points: Channel<Point>,
};

export class CanvasView {
	private start = { x: -1, y: -1 };

	private targetRect: DOMRect;
	private targetStart = { x: -1, y: -1 };

	public elementBounds: DOMRectReadOnly;

	private activeGestures: { [key: number]: DragGestureState } = {};

	public ondraggesture: null | ((_: DragGestureState) => void) = null;

	constructor(
		public readonly svgElement: SVGSVGElement,
	) {
		svgElement.setAttribute("viewBox", "0 0 0 0");
		this.targetRect = svgElement.viewBox.baseVal;
		this.elementBounds = new DOMRect();

		new ResizeObserver(() => {
			const elemBounds = svgElement.getBoundingClientRect();
			this.elementBounds = elemBounds;

			this.targetRect.width = elemBounds.width / PX_PER_CM;
			this.targetRect.height = elemBounds.height / PX_PER_CM;
		}).observe(svgElement);

		svgElement.onpointerdown = this.mouseDown.bind(this);
		svgElement.onpointerup = this.mouseUp.bind(this);
	}

	public translateCoordinate(x: number, y: number) {
		const rx = x - this.elementBounds.x;
		const ry = y - this.elementBounds.y;

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

	private mouseDown(e: PointerEvent): void {
		logger.debug("Mouse down: %o", e);
		logger.debug("Gestures: %o", this.activeGestures);
		const id = e.pointerId;
		const gesture: DragGestureState = {
			initialOrigin: this.getOrigin(),
			points: new Channel(),
		};

		if (this.ondraggesture) {
			gesture.points.push(this.translateCoordinate(e.x, e.y));
			this.ondraggesture(gesture);
		}

		this.activeGestures[id] = gesture;
		this.svgElement.onpointermove = this.mouseMove.bind(this);
	}

	private mouseUp(e: PointerEvent): void {
		delete this.activeGestures[e.pointerId];
		this.svgElement.onpointermove = null;
	}

	private mouseMove(e: PointerEvent): void {
		const id = e.pointerId;
		const gesture = this.activeGestures[id];
		if (!gesture) return;

		const x = (e.offsetX / PX_PER_CM) + gesture.initialOrigin.x;
		const y = (e.offsetY / PX_PER_CM) + gesture.initialOrigin.y;

		gesture.points?.push({ x, y });
	}
}