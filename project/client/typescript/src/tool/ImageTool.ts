import { Logger } from "../Logger.js";
import { SingletonPropertyStore, PropKey } from "../Properties.js";
import { builder } from "../PropertyTemplates.js";
import { PressGesture } from "../canvas/Gesture.js";
import { Item } from "../gen/Types.js";
import { None, point } from "../util/Utils.js";
import { ActionToolBase } from "./Tool.js";

const logger = new Logger("tool/Image");

const { keys, schema } = builder()
	.add("url", {
		type: "resource",
		key: new PropKey("resource"),
		displayName: "Location",
		accept: ["image/*"],
	})
	.add("alt", {
		type: "text",
		key: new PropKey("text", { defaultValue: "" }),
		displayName: "Description",
		display: "short",
	})
	.build();

export class ImageTool extends ActionToolBase {
	public override readonly properties = new SingletonPropertyStore(schema);

	protected override cancelAction(): void { }

	protected override async onPressGesture(gesture: PressGesture) {
		logger.debug("Press gesture");
		const location = this.properties.read(keys.url);
		if (location === None) return;

		this.start();

		const item: Item = {
			type: "Image",
			transform: {
				origin: gesture.location,
				basisX: point(1, 0),
				basisY: point(0, 1),

			},
			url: location.toString(),
			description: this.properties.read(keys.alt),
		};

		await this.board.client.method.CreateItem({ item });

		this.end();
	}
}