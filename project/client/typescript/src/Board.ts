import { CanvasController } from "./canvas/Canvas.js";
import { SessionClient } from "./client/Client.js";
import { ClientInfo } from "./gen/Types.js";
import { ToolIcon } from "./ui/Icon.js";
import { createEditToolList } from "./ui/ToolLayout.js";
import { UIManager } from "./ui/UIManager.js";

export class Board {
	public static async new(name: string, info: ClientInfo): Promise<Board> {
		const canvas = new CanvasController();
		const ui = new UIManager(canvas.svgElem);
		const client = await SessionClient.new(name, info);

		return new this(
			ui, client, canvas
		);
	}

	private constructor(
		public readonly ui: UIManager,
		public readonly client: SessionClient,
		public readonly canvas: CanvasController,
	) {
		for (const [name, tool] of createEditToolList(this)) {
			const icon = new ToolIcon(name, tool);
			ui.addToolIcon(icon);
		}

		client.bindNotify("ItemCreated", ({ id, item }) => {
			canvas.addItem(id, item);
		});
	}
}