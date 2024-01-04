import { CanvasView, DragGestureState } from "../ui/CanvasView";
import { Channel } from "../util/Channel";

export enum ToolType {
	Action,
	Mode,
	Instantaneous,
}

export interface ModeTool {
	type: ToolType.Mode;

	bind(): void;
	unbind(): void;
}

export interface Action {
	cancel(): void;
	completion: Promise<void>;
}

export interface ActionTool {
	type: ToolType.Action;

	execute(): Action;
}

export interface InstantaneousTool {
	type: ToolType.Instantaneous;

	execute(): void;
}

export type Tool = ModeTool | ActionTool | InstantaneousTool;

abstract class ToolBase {
	public abstract get type(): ToolType;
}

abstract class InteractiveToolBase extends ToolBase {
	protected constructor(
		protected canvas: CanvasView,
	) {
		super();
	}

	protected onDragGesture?(gesture: DragGestureState): void;

	protected onClickGesture?(x: number, y: number): void;

}

export abstract class ActionToolBase extends InteractiveToolBase implements ActionTool {
	public override get type(): ToolType.Action { return ToolType.Action; }

	public abstract execute(): Action;
}

export abstract class ModeToolBase extends InteractiveToolBase implements ModeTool {
	public override get type(): ToolType.Mode { return ToolType.Mode; }

	public bind(): void {
		if (this.onDragGesture) {
			this.canvas.ondraggesture = this.onDragGesture.bind(this);
		}
	}

	public unbind(): void {
		if (this.canvas.ondraggesture === this.onDragGesture) {
			this.canvas.ondraggesture = null;
		}
	}
}

export abstract class InstantaneousToolBase extends ToolBase implements InstantaneousTool {
	public override get type(): ToolType.Instantaneous {
		return ToolType.Instantaneous;
	}

	public abstract execute(): void;
}