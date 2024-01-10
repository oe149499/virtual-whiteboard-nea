import { CanvasController } from "./canvas/Canvas.js";
import { StrokeHelper } from "./canvas/CanvasBase.js";
import { PathHelper } from "./canvas/Path.js";
import { SessionClient } from "./client/Client.js";
import { ClientID, ClientInfo, Stroke } from "./gen/Types.js";
import { ToolIcon } from "./ui/Icon.js";
import { createEditToolList } from "./ui/ToolLayout.js";
import { UIManager } from "./ui/UIManager.js";
import { splitFirstAsync } from "./util/Utils.js";

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

		client.bindNotify("PathStarted", ({ id, stroke }) => {
			this.handlePath(id, stroke);
		});
	}

	private async handlePath(id: ClientID, stroke: Stroke) {
		if (id == this.client.clientID) return;
		const pathElem = this.canvas.ctx.createElement("path");
		pathElem.setAttribute("fill", "none");

		this.canvas.addRawElement(pathElem);

		const _points = this.client.iterate.GetActivePath({
			client: id,
		});

		const [first, points] = await splitFirstAsync(_points);

		const helper = new PathHelper(pathElem, first.shift()!.position);
		new StrokeHelper(pathElem.style, stroke);

		helper.addNodes(first);

		for await (const chunk of points) {
			helper.addNodes(chunk);
		}

		pathElem.remove();
	}
}