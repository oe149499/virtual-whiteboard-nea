import { Item, ItemID } from "../gen/Types.js";
import { CanvasContext, SVGNS } from "./CanvasBase.js";
import { CanvasItem } from "./CanvasItems.js";

export class CanvasController {
	readonly svgElem = document.createElementNS(SVGNS, "svg");
	private ctx: CanvasContext;
	private items = {} as {[x: ItemID]: CanvasItem};

	constructor() {
		this.ctx = new CanvasContext(this.svgElem);
	}

	public addItem(id: ItemID, item: Item) {
		const canvas_item = CanvasItem.create(this.ctx, item);
		this.items[id] = canvas_item;
		this.svgElem.appendChild(canvas_item.element);
	}
}