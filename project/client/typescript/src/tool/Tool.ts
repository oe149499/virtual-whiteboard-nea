import type { Board } from "../Board.js";
import { Property } from "../Properties.js";
import { DragGestureState } from "../canvas/Gesture.js";

export enum ToolType {
	Action,
	Mode,
	Instantaneous,
}

interface _Tool {
	properties: Property[];
}

export interface ModeTool extends _Tool {
	type: ToolType.Mode;

	bind(): void;
	unbind(): void;
}

export interface Action {
	cancel(): void;
	completion: Promise<void>;
}

type OnBegin = (_: Action) => void;

export interface ActionTool extends _Tool {
	type: ToolType.Action;

	bind(onBegin: OnBegin): void;
}

export interface InstantaneousTool {
	type: ToolType.Instantaneous;

	execute(): void;
}

export type Tool = ModeTool | ActionTool | InstantaneousTool;

abstract class ToolBase {
	public abstract get type(): ToolType;
	protected get canvas() {
		return this.board.canvas;
	}

	public properties: Property[];

	protected buildProperties(): Property[] {
		return [];
	}

	protected init?(): void;

	public constructor(
		protected board: Board,
	) {
		this.properties = this.buildProperties();
		this.init?.();
	}
}

type GestureHandlers = {
	drag: (_: DragGestureState) => void,
	click: (x: number, y: number) => void,
};

abstract class InteractiveToolBase extends ToolBase {
	#gestureHandlers: GestureHandlers | null = null;

	private get gestureHandlers() {
		if (!this.#gestureHandlers) {
			const handlers: Partial<GestureHandlers> = {};
			handlers.drag = this.onDragGesture?.bind(this) ?? (() => { });
			handlers.click = this.onClickGesture?.bind(this) ?? (() => { });
			this.#gestureHandlers = handlers as GestureHandlers;
		}
		return this.#gestureHandlers;
	}

	protected onDragGesture?(gesture: DragGestureState): void;
	protected get dragHandler() { return this.gestureHandlers.drag; }

	protected onClickGesture?(x: number, y: number): void;
	protected get clickHandler() { return this.gestureHandlers.click; }

	protected unbindGestures() {
		if (this.canvas.ondraggesture === this.dragHandler)
			this.canvas.ondraggesture = null;
	}
}

export abstract class ActionToolBase extends InteractiveToolBase implements ActionTool {
	public override get type(): ToolType.Action { return ToolType.Action; }
	protected singleGesture = true;
	private onBegin: OnBegin | null = null;
	private completionResolve: (() => void) | null = null;

	public bind(onBegin: OnBegin) {
		this.onBegin = onBegin;
		this.canvas.ondraggesture = this.dragHandler;
	}

	protected start() {
		this.onBegin?.({
			cancel: () => this.cancel(),
			completion: new Promise((resolve) => {
				this.completionResolve = resolve;
			}),
		});
	}
	protected end() {
		this.unbindGestures();
		this.completionResolve?.();
	}

	protected abstract cancel(): void;
}

export abstract class ModeToolBase extends InteractiveToolBase implements ModeTool {
	public override get type(): ToolType.Mode { return ToolType.Mode; }

	public bind(): void {
		this.canvas.ondraggesture = this.dragHandler;
	}

	public unbind(): void {
		this.unbindGestures();
	}
}

export abstract class InstantaneousToolBase extends ToolBase implements InstantaneousTool {
	public override get type(): ToolType.Instantaneous {
		return ToolType.Instantaneous;
	}

	public abstract execute(): void;
}