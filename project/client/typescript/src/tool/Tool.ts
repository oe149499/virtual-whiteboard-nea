import type { Board } from "../Board.js";
import { SingletonPropertyStore } from "../Properties.js";
import { DragGestureState, FilterHandle, GestureLayer, GestureType, LongPressGesture, PressGesture } from "../canvas/Gesture.js";
import { None } from "../util/Utils.js";

export type ToolState = {
	tool: ModeTool,
} | {
	tool: ActionTool,
	action?: Action,
} | None;

export enum ToolType {
	Action,
	Mode,
	Instantaneous,
}

interface _Tool {
	properties?: SingletonPropertyStore;
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

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
interface ToolBase {
	readonly properties?: SingletonPropertyStore;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
abstract class ToolBase implements _Tool {
	public abstract get type(): ToolType;
	protected get canvas() {
		return this.board.canvas;
	}

	protected get ctx() {
		return this.board.canvas.ctx;
	}

	protected init?(): void;

	public constructor(
		protected board: Board,
	) {
		this.init?.();
	}
}

abstract class InteractiveToolBase extends ToolBase {
	#filterHandle?: FilterHandle;

	protected get gestureFilter(): FilterHandle {
		if (!this.#filterHandle) {
			const filter = this.ctx.createGestureFilter(GestureLayer.AboveItems).pause();
			if (this.onDragGesture)
				filter.addHandler(GestureType.Drag, this.onDragGesture.bind(this));
			if (this.onPressGesture)
				filter.addHandler(GestureType.Click, this.onPressGesture.bind(this));
			if (this.onLongPressGesture)
				filter.addHandler(GestureType.LongClick, this.onLongPressGesture.bind(this));
			this.#filterHandle = filter;
		}
		return this.#filterHandle;
	}

	protected onDragGesture?(gesture: DragGestureState): void;
	protected onPressGesture?(gesture: PressGesture): void;
	protected onLongPressGesture?(gesture: LongPressGesture): void;
}

export abstract class ActionToolBase extends InteractiveToolBase implements ActionTool {
	public override get type(): ToolType.Action { return ToolType.Action; }
	protected singleGesture = true;
	private onBegin?: OnBegin;
	private completionResolve?: (() => void);

	public bind(onBegin: OnBegin) {
		this.onBegin = onBegin;
		this.gestureFilter.resume();
	}

	protected start() {
		this.onBegin?.({
			cancel: this.cancel.bind(this),
			completion: new Promise((resolve) => {
				this.completionResolve = resolve;
			}),
		});
	}

	protected end() {
		this.gestureFilter.pause();
		this.completionResolve?.();
	}

	protected abstract cancel(): void;
}

export abstract class ModeToolBase extends InteractiveToolBase implements ModeTool {
	public override get type(): ToolType.Mode { return ToolType.Mode; }

	public bind(): void {
		this.gestureFilter.resume();
	}

	public unbind(): void {
		this.gestureFilter.pause();
	}
}

export abstract class InstantaneousToolBase extends ToolBase implements InstantaneousTool {
	public override get type(): ToolType.Instantaneous {
		return ToolType.Instantaneous;
	}

	public abstract execute(): void;
}