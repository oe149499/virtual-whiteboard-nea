import type { ItemType, SpecificItem } from "../GenWrapper.js";
import { PX_PER_CM } from "../canvas/CanvasBase.js";
import type { PressGesture } from "../canvas/Gesture.js";
import type { Item, LinkItem, Transform } from "../gen/Types.js";
import { point } from "../util/Utils.js";
import { ActionToolBase } from "./Tool.js";

abstract class TextToolBase<T extends ItemType> extends ActionToolBase {
	protected override async onPressGesture(gesture: PressGesture) {
		this.start();
		// @ts-ignore
		const item: SpecificItem<T> = {
			transform: {
				origin: gesture.location,
				basisX: point(1 / PX_PER_CM, 0),
				basisY: point(0, 1 / PX_PER_CM),
			},
			...this.makeItem(),
		};

		const id = await this.board.client.method.CreateItem({ item });

		// await new Promise(r => setTimeout(r, 100));

		// this.board.items.addOwnSelection([id]);
		this.end();
	}

	protected abstract makeItem(): Omit<SpecificItem<T>, "transform">;

	protected override cancelAction() { }
}

export class TextTool extends TextToolBase<"Text"> {
	protected override makeItem(): Omit<SpecificItem<"Text">, "transform"> {
		return {
			type: "Text",
			text: "",
		};
	}
}

export class LinkTool extends TextToolBase<"Link"> {
	protected override makeItem(): Omit<{ type: "Link" } & LinkItem, "transform"> {
		return {
			type: "Link",
			text: "",
			url: "https://",
		};
	}
}