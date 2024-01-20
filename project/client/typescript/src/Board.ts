import { Logger } from "./Logger.js";
import { CanvasController } from "./canvas/Canvas.js";
import { StrokeHelper } from "./canvas/CanvasBase.js";
import { PathHelper } from "./canvas/Path.js";
import { SessionClient } from "./client/Client.js";
import { ClientID, ClientInfo, PathID, Stroke } from "./gen/Types.js";
import { ToolIcon } from "./ui/Icon.js";
import { createEditToolList } from "./ui/ToolLayout.js";
import { UIManager } from "./ui/UIManager.js";
import { AsyncIter } from "./util/AsyncIter.js";
import { None } from "./util/Utils.js";

const logger = new Logger("board");

export class Board {
	public static async new(name: string, info: ClientInfo): Promise<Board> {
		const canvas = new CanvasController();
		const ui = new UIManager(canvas);
		const client = await SessionClient.new(name, info);

		const board = new this(ui, client, canvas);

		await board.init();

		return board;
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

		client.bindNotify("PathStarted", ({ path, stroke, client }) => {
			this.handlePath(client, stroke, path);
		});
	}

	private async init() {
		(async () => {
			const ids = await this.client.method.GetAllItemIDs({});
			const items = this.client.iterate.GetFullItems({ ids });

			for await (const [id, res] of AsyncIter.zip(
				AsyncIter.of(ids), items.dechunk()
			)) {
				const { status, value: item } = res;
				if (status == "Ok") {
					this.canvas.addItem(id, item);
				} else {
					logger.error("Recieved error code fetching item %o: %o", id, item);
				}
			}
		})();
	}

	private async handlePath(client: ClientID, stroke: Stroke, path: PathID) {
		if (client == this.client.clientID) return;

		const points = this.client.iterate.GetActivePath({
			path
		});

		const first = await points.next();

		if (first === None) return;

		const pathElem = this.canvas.ctx.createElement("path");
		pathElem.setAttribute("fill", "none");

		this.canvas.addRawElement(pathElem);

		const helper = new PathHelper(pathElem, first.shift()!.position);
		new StrokeHelper(pathElem.style, stroke);

		helper.addNodes(first);

		for await (const chunk of points) {
			helper.addNodes(chunk);
		}

		pathElem.remove();
	}
}