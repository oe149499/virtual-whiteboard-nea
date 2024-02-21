import { Logger } from "./Logger.js";
import { CanvasController } from "./canvas/Canvas.js";
import { StrokeHelper } from "./canvas/CanvasBase.js";
import { BoardTable } from "./BoardTable.js";
import { PathHelper } from "./canvas/Path.js";
import { SessionClient } from "./client/Client.js";
import { ClientID, ClientInfo, PathID, Stroke } from "./gen/Types.js";
import { ToolIcon } from "./ui/Icon.js";
import { createEditToolList } from "./ui/ToolLayout.js";
import { UIManager } from "./ui/UIManager.js";
import { AsyncIter } from "./util/AsyncIter.js";
import { None } from "./util/Utils.js";

const logger = new Logger("board");

type BoardInfo = ClientInfo & {
	boardName: string,
	clientID: number,
}

export class Board {
	public static async new(name: string, info: ClientInfo): Promise<Board> {
		const client = await SessionClient.new(name, info);
		const items = new BoardTable(client);
		const canvas = new CanvasController(items);
		const ui = new UIManager(canvas);
		const boardInfo = { ...info, boardName: name, clientID: client.clientID };

		const board = new this(ui, client, canvas, items, boardInfo);

		queueMicrotask(() => board.init());

		return board;
	}

	private constructor(
		public readonly ui: UIManager,
		public readonly client: SessionClient,
		public readonly canvas: CanvasController,
		public readonly items: BoardTable,
		public readonly info: BoardInfo,
	) { }

	private async init() {
		for (const [name, tool] of createEditToolList(this)) {
			const icon = new ToolIcon(name, tool);
			this.ui.addToolIcon(icon);
		}

		this.ui.containerElement.classList.setBy("gesture-active", this.canvas.isGesture);

		this.client.bindNotify("PathStarted", ({ path, stroke, client }) => {
			this.handlePath(client, stroke, path);
		});
	}

	private async handlePath(client: ClientID, stroke: Stroke, path: PathID) {
		if (client == this.client.clientID) return;

		const points = this.client.iterate.GetActivePath({
			path,
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