import { Logger } from "../Logger.js";
import { PropertySchema, SingletonPropertyStore, PropKey } from "../Properties.js";
import { builder } from "../PropertyTemplates.js";
import { PressGesture } from "../canvas/Gesture.js";
import { Item } from "../gen/Types.js";
import { None, Option, point } from "../util/Utils.js";
import { ActionToolBase } from "./Tool.js";

const logger = new Logger("tool/Image");

// const propSchema = Object.freeze({
// 	location: None as Option<URL>,
// 	description: "",
// });

// const keys = {
// 	url: new PropKey("resource"),
// 	alt: new PropKey("text"),
// };

// const schema: PropertySchema[] = [
// 	{
// 		type: "resource",
// 		key: keys.url,
// 		displayName: "Location",
// 	},
// 	{
// 		type: "text",
// 		key: keys.alt,
// 		displayName: "Description",
// 	}
// ];

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
	// public constructor(board: Board) {
	// 	super(board);
	// 	const { store, props } = buildProperties(propSchema, $ => {
	// 		$.file("location").as("Image file");
	// 		$.text("description").as("Alternative Text");
	// 	});
	// 	this.propStore = store;
	// 	this._properties = props;
	// }

	// private readonly propStore: PropertyStore<typeof propSchema>;
	// public override readonly _properties: PropertyMap<typeof propSchema>;
	public override readonly properties = new SingletonPropertyStore(schema);

	protected override cancel(): void { }

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