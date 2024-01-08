import type { Board } from "../Board.js";
import { Property, PropertyBuilder } from "../Properties.js";
import { CanvasView, DragGestureState } from "../ui/CanvasView.js";

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

export interface InstantaneousTool extends _Tool {
	type: ToolType.Instantaneous;

	execute(): void;
}

export type Tool = ModeTool | ActionTool | InstantaneousTool;

abstract class ToolBase {
	public abstract get type(): ToolType;
	protected get canvasView() {
		return this.board.ui.canvas;
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

abstract class InteractiveToolBase extends ToolBase {
	protected onDragGesture?(gesture: DragGestureState): void;

	protected onClickGesture?(x: number, y: number): void;
}

export abstract class ActionToolBase extends InteractiveToolBase implements ActionTool {
	public override get type(): ToolType.Action { return ToolType.Action; }
	protected singleGesture = true;
	private onBegin: OnBegin | null = null;
	private completionResolve: (() => void) | null = null;

	private unbindGestures() {
		this.canvasView.ondraggesture = null;
	}

	public bind(onBegin: OnBegin) {
		this.onBegin = onBegin;
		this.canvasView.ondraggesture = (g) => {
			this.onDragGesture?.(g);
			if (this.singleGesture) this.unbindGestures();
		};
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
		if (this.onDragGesture) {
			this.canvasView.ondraggesture = this.onDragGesture.bind(this);
		}
	}

	public unbind(): void {
		if (this.canvasView.ondraggesture === this.onDragGesture) {
			this.canvasView.ondraggesture = null;
		}
	}
}

export abstract class InstantaneousToolBase extends ToolBase implements InstantaneousTool {
	public override get type(): ToolType.Instantaneous {
		return ToolType.Instantaneous;
	}

	public abstract execute(): void;
}