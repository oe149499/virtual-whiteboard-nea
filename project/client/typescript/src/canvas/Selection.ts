import { asDomMatrix, fromMatrix, updateMatrix } from "../Transform.js";
import type { ClientID, ItemID, Transform } from "../gen/Types.js";
import { mutableStateOf } from "../util/State.js";
import { None, point } from "../util/Utils.js";
import type { CanvasContext } from "./CanvasBase.js";
import type { ItemEntry, BoardTable } from "./ItemTable.js";

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
	private itemContainer: SVGGElement;
	protected rootTransform: SVGGElement;
	private stagingContainer: SVGGElement;
	private uiContainer: SVGGElement;

	protected srt = mutableStateOf(new DOMMatrix());

	protected items = new Map<ItemID, ItemHolder>();

	protected constructor(
		protected ctx: CanvasContext,
		protected table: BoardTable,
	) {
		const rootElement = ctx.createRootElement("g").addClasses("selection-container");
		this.itemContainer = rootElement.createChild("g").addClasses("selection-item-container");
		this.rootTransform = this.itemContainer.createChild("g").addClasses("selection-root-transform");
		this.stagingContainer = this.itemContainer.createChild("g").addClasses("selection-staging-container");
		this.uiContainer = rootElement.createChild("g").addClasses("selection-ui-container");

		const transform = ctx.createTransform();
		this.rootTransform.transform.baseVal.appendItem(transform);
		this.srt.watch(m => transform.setMatrix(m));
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
	public constructor(
		ctx: CanvasContext,
		table: BoardTable,
		private init: RemoteSelectionInit,
	) {
		super(ctx, table);

		for (const [id, transform] of init.items) {
			const entry = this.table.get(id);
			if (entry === None) continue;
			const holder = new ItemHolder(this.ctx, entry.canvasItem.element);
			updateMatrix(holder.sit, transform);
			this.rootTransform.append(holder.element);
			this.items.set(id, holder);
		}

		this.srt.updateBy(m => updateMatrix(m, init.srt));
	}

	public addItems(newSits: TransformRecord[], newSrt: Transform) {
		this.addFromTransforms(newSits, newSrt);
	}
}

export class LocalSelection extends SelectionBox {
	public constructor(
		ctx: CanvasContext,
		table: BoardTable,
	) {
		super(ctx, table);
	}

	public createAddPayload(entries: ItemEntry[]) {
		return this.addFromCanvas(entries);
	}
}