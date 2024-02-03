import { Board } from "../Board.js";
import { PropertyMap, PropertyStore, buildProperties } from "../Properties.js";
import { PressGesture } from "../canvas/Gesture.js";
import { Item } from "../gen/Types.js";
import { None, Option, point } from "../util/Utils.js";
import { ActionToolBase } from "./Tool.js";

const propSchema = Object.freeze({
	location: None as Option<URL>,
	description: "",
});

export class ImageTool extends ActionToolBase {
	public constructor(board: Board) {
		super(board);
		const { store, props } = buildProperties(propSchema, $ => {
			$.file("location").as("Image file");
			$.text("description").as("Alternative Text");
		});
		this.propStore = store;
		this._properties = props;
	}

	private readonly propStore: PropertyStore<typeof propSchema>;
	public override readonly _properties: PropertyMap<typeof propSchema>;

	protected override cancel(): void { }

	protected override async onPressGesture(gesture: PressGesture) {
		const location = this.propStore.location.get();
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
			description: this.propStore.description.get(),
		};

		await this.board.client.method.CreateItem({ item });

		this.end();
	}
}