import { Logger } from "../Logger.js";
import { PropertyMap, PropertyStore, buildProperties } from "../Properties.js";
import { StrokeHelper } from "../canvas/CanvasBase.js";
import { PathHelper } from "../canvas/Path.js";
import { DragGestureState } from "../canvas/Gesture.js";
import { ActionToolBase } from "./Tool.js";
import { Board } from "../Board.js";
import { State, Stateless, collectStateOf } from "../util/State.js";
import { None } from "../util/Utils.js";
const logger = new Logger("tool/Path");

const propSchema = {
	stroke: {
		width: 0.1,
		color: "black",
	}
};

export class PathTool extends ActionToolBase {
	public constructor(board: Board) {
		super(board);
		const { store, props } = buildProperties(propSchema, $ => {
			$.struct("stroke", $ => {
				$.number("width");
				$.color("color");
			});
		});
		this.propStore = store;
		this.properties = props;
		this.props = collectStateOf(this.propStore);
	}

	private readonly propStore: PropertyStore<typeof propSchema>;
	private readonly props: State<Stateless<typeof propSchema>>;
	public override readonly properties: PropertyMap<typeof propSchema>;

	protected override async onDragGesture(gesture: DragGestureState) {
		const { points } = gesture;
		const stroke = { ...this.props.get().stroke };

		const first = await points.next();

		if (first === None) return;

		this.start();

		const pathId = await this.board.client.method.BeginPath({ stroke });

		const pathElem = this.board.canvas.ctx.createElement("path");
		pathElem.setAttribute("fill", "none");
		this.board.canvas.addRawElement(pathElem);

		const helper = new PathHelper(pathElem, first);
		new StrokeHelper(pathElem.style, stroke);

		for await (const point of points) {
			const node = {
				position: point,
				velocity: { x: 0, y: 0 },
			};
			await this.board.client.method.ContinuePath({ pathId, points: [node] });
			helper.addNode({
				position: point,
				velocity: { x: 0, y: 0 },
			});
		}

		this.end();

		pathElem.remove();

		await this.board.client.method.EndPath({ pathId });
	}

	protected override cancel(): void {

	}
}