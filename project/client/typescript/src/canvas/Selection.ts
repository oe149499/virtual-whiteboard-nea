import { Logger } from "../Logger.js";
import { asDomMatrix, fromMatrix, updateMatrix } from "../Transform.js";
import type { ClientID, ItemID, Point, Transform } from "../gen/Types.js";
import { mutableStateOf, type State } from "../util/State.js";
import { None, OwnedInterval, point } from "../util/Utils.js";
import type { CanvasContext } from "./CanvasBase.js";
import { GestureLayer, GestureType, type DragGestureState } from "./Gesture.js";
import type { ItemEntry, BoardTable } from "../BoardTable.js";
import { SelectionBorder, RotateHandle, StretchHandleSet } from "./SelectionUI.js";

const logger = new Logger("canvas/Selection");

export type TransformRecord = [id: ItemID, transform: Transform];

class ItemHolder {
	public readonly element: SVGGElement;
	public readonly sit: DOMMatrix;

	private transform: SVGTransform;

	public constructor(
		ctx: CanvasContext,
		public readonly inner: SVGElement,
	) {
		this.element = ctx.createElement("g").addClasses("selection-item-holder");
		this.element.appendChild(inner);

		const transform = ctx.createTransform();
		this.transform = transform;
		this.element.transform.baseVal.appendItem(transform);
		this.sit = transform.matrix;
	}

	public updateSit(matrix: DOMMatrixReadOnly) {
		this.transform.setMatrix(matrix);
	}
}

export abstract class SelectionBox {
	protected rootElement: SVGGElement;
	protected itemContainer: SVGGElement;
	protected rootTransform: SVGGElement;
	private stagingContainer: SVGGElement;
	protected uiContainer: SVGGElement;

	protected srt = mutableStateOf(new DOMMatrix());

	protected size: State<Point>;

	protected items = new Map<ItemID, ItemHolder>();

	protected constructor(
		protected ctx: CanvasContext,
		protected table: BoardTable,
	) {
		const rootElement = ctx.createRootElement("g").addClasses("selection-container");
		this.rootElement = rootElement;
		this.itemContainer = rootElement.createChild("g").addClasses("selection-item-container");
		this.rootTransform = this.itemContainer.createChild("g").addClasses("selection-root-transform");
		this.stagingContainer = this.itemContainer.createChild("g").addClasses("selection-staging-container");
		this.uiContainer = rootElement.createChild("g").addClasses("selection-ui-container");

		const transform = ctx.createTransform();
		this.rootTransform.transform.baseVal.appendItem(transform);
		this.srt.watch(m => transform.setMatrix(m));

		this.size = this
			.rootTransform
			.getBBoxState()
			.derived(
				({ width, height }: DOMRect) => point(width + 0.5, height + 0.5),
			);
	}

	protected addFromTransforms(newSits: TransformRecord[], newSrt: Transform) {
		const newSrtMat = asDomMatrix(newSrt);
		const newSrtInv = newSrtMat.inverse();
		const sitUpdateMatrix = newSrtInv.multiply(this.srt.get());

		for (const [_, item] of this.items.entries()) {
			item.sit.preMultiplySelf(sitUpdateMatrix);
		}

		for (const [id, transform] of newSits) {
			const entry = this.table.get(id);
			if (entry === None) continue;
			const holder = new ItemHolder(this.ctx, entry.canvasItem.element);
			updateMatrix(holder.sit, transform);
			this.rootTransform.append(holder.element);
			this.items.set(id, holder);
		}
	}

	protected addFromCanvas(entries: ItemEntry[]) {
		const ids = new Set<ItemID>();
		entries.forEach(({ canvasItem, id }: ItemEntry) => {
			this.stagingContainer.append(canvasItem.element);
			ids.add(id);
		});

		const newBounds = this.itemContainer.getBBox();

		const centre = {
			x: (newBounds.left + newBounds.right) / 2,
			y: (newBounds.top + newBounds.bottom) / 2,
		};

		const newSrt: Transform = {
			origin: centre,
			basisX: point(1, 0),
			basisY: point(0, 1),
		};

		const newTransform = {
			origin: point(-centre.x, -centre.y),
			basisX: point(1, 0),
			basisY: point(0, 1),
		};

		this.addFromTransforms(entries.map(
			({ id }) => [id, newTransform],
		), newSrt);

		const existingUpdates: TransformRecord[] = [];
		const newUpdates: TransformRecord[] = [];

		for (const [id, item] of this.items.entries()) {
			if (ids.has(id)) {
				newUpdates.push([id, newTransform]);
			} else {
				existingUpdates.push([id, fromMatrix(item.sit)]);
			}
		}

		this.srt.updateTransform(newSrt);

		return {
			newSrt,
			oldSits: existingUpdates,
			newSits: newUpdates,
		};
	}
}

export interface RemoteSelectionInit {
	id: ClientID;
	srt: Transform;
	items: TransformRecord[];
}

export class RemoteSelection extends SelectionBox {
	private border: SelectionBorder;

	public constructor(
		ctx: CanvasContext,
		table: BoardTable,
		private init: RemoteSelectionInit,
	) {
		super(ctx, table);

		this.rootElement.id = `remote-selection-${init.id}`;

		for (const [id, transform] of init.items) {
			const entry = this.table.get(id);
			if (entry === None) continue;
			const holder = new ItemHolder(this.ctx, entry.canvasItem.element);
			updateMatrix(holder.sit, transform);
			this.rootTransform.append(holder.element);
			this.items.set(id, holder);
		}

		this.srt.updateTransform(init.srt);

		this.border = new SelectionBorder(ctx, this.srt, this.size);
		this.uiContainer.appendChild(this.border.element);
	}

	public addItems(newSits: TransformRecord[], newSrt: Transform) {
		this.addFromTransforms(newSits, newSrt);
	}

	public moveItems(newSrt: Transform, newSits?: TransformRecord[]) {
		this.srt.updateTransform(newSrt);
		if (newSits) for (const [id, transform] of newSits) {
			const sit = this.items.assume(id).sit;
			updateMatrix(sit, transform);
		}
	}
}

export interface LocalSelectionInit {
	srt: Transform;
	items: TransformRecord[];
}

export class LocalSelection extends SelectionBox {
	private border: SelectionBorder;
	private rotateHandle: RotateHandle;
	private stretchHandles: StretchHandleSet;

	private srtUpdateSent = true;

	private _sendSrtUpdate = new OwnedInterval(() => {
		if (!this.srtUpdateSent) {
			this.table.moveOwnSelection(fromMatrix(this.srt.get()));
			this.srtUpdateSent = true;
		}
	}, 500);

	private updateSrt = (m: DOMMatrix) => {
		this.srt.set(m);
		this.srtUpdateSent = false;
	};

	public constructor(
		ctx: CanvasContext,
		table: BoardTable,
		init?: LocalSelectionInit,
	) {
		super(ctx, table);

		this.rootElement.id = "own-selection";

		if (init) {
			this.addFromTransforms(init.items, init.srt);
			this.srt.updateTransform(init.srt);
		}
		// this.srt.updateDerived = false;

		this.border = new SelectionBorder(ctx, this.srt, this.size);
		this.uiContainer.appendChild(this.border.element);

		this.rotateHandle = new RotateHandle(ctx, this.srt, this.size, this.updateSrt);
		this.uiContainer.appendChild(this.rotateHandle.element);

		this.stretchHandles = new StretchHandleSet(ctx, this.srt, this.size, this.updateSrt)
			.connectParent(this.uiContainer);

		const invSrt = this.srt.derived(m => m.inverse());

		ctx.createGestureFilter(GestureLayer.Selection)
			.setTest(p => {
				// logger.debug("Initial location: %o, SRT: %o", p, this.srt.get());
				const transformed = invSrt.get().transformPoint(p);
				// logger.debug("location in selection space: ", transformed);
				const tx = Math.abs(transformed.x * 2);
				const ty = Math.abs(transformed.y * 2);
				const { x, y } = this.size.get();
				// logger.debug("Size: %o, %o; Transformed: %o, %o", x, y, tx, ty);
				return (tx <= x) && (ty <= y);
			})
			.addHandler(GestureType.Drag, this.handleDrag.bind(this));
	}

	private async handleDrag(gesture: DragGestureState) {
		const startTransform = this.srt.getSnapshot();

		const offsetX = startTransform.e - gesture.location.x;
		const offsetY = startTransform.f - gesture.location.y;

		for await (const { x, y } of gesture.points) {
			// logger.debug("Cursor location: x %o, y %o; Start location: x %o, y %o", x, y, startX, startY);
			startTransform.e = offsetX + x;
			startTransform.f = offsetY + y;
			this.updateSrt(startTransform);
		}
	}

	public createAddPayload(entries: ItemEntry[]) {
		return this.addFromCanvas(entries);
	}

	public * getFinalTransforms(): Iterable<[ItemID, DOMMatrix]> {
		const srt = this.srt.get();
		for (const [id, sit] of this.items.entries()) {
			yield [id, srt.multiply(sit.sit)];
		}
	}
}