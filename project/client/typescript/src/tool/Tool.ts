import type { Board } from "../Board.js";
import { SingletonPropertyStore } from "../Properties.js";
import { DragGestureState, GestureLayer, GestureType, LongPressGesture, PressGesture } from "../canvas/Gesture.js";
import { BlockDeepReadonly } from "../util/State.js";
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

export type Action = Promise<void>;
type OnBegin = (_: Action) => void;

export type Tool = ModeTool | ActionTool | InstantaneousTool;

abstract class ToolBase {
	[BlockDeepReadonly]?(): unknown;
	protected get canvas() {
		return this.board.canvas;
	}

	protected get ctx() {
		return this.board.canvas.ctx;
	}

	public constructor(
		protected board: Board,
	) { }

	public readonly properties?: SingletonPropertyStore;
}

abstract class InteractiveToolBase extends ToolBase {
	private makeFilter() {
		const filter = this.ctx.createGestureFilter(GestureLayer.AboveItems).pause();
		if (this.onDragGesture)
			filter.addHandler(GestureType.Drag, this.onDragGesture.bind(this));
		if (this.onPressGesture)
			filter.addHandler(GestureType.Click, this.onPressGesture.bind(this));
		if (this.onLongPressGesture)
			filter.addHandler(GestureType.LongClick, this.onLongPressGesture.bind(this));
		return filter;
	}

	protected gestureFilter = this.makeFilter();

	protected onDragGesture?(gesture: DragGestureState): void;
	protected onPressGesture?(gesture: PressGesture): void;
	protected onLongPressGesture?(gesture: LongPressGesture): void;
}

export abstract class ActionTool extends InteractiveToolBase {
	public get type(): ToolType.Action { return ToolType.Action; }

	private onBegin?: OnBegin;
	private completionResolve?: (() => void);
	private active = false;

	public bind(onBegin: OnBegin) {
		this.onBegin = onBegin;
		this.gestureFilter.resume();
	}

	protected start() {
		this.active = true;
		const { promise, resolve } = Promise.withResolvers<void>();
		this.completionResolve = resolve;
		this.onBegin?.(promise);
	}

	protected end() {
		this.gestureFilter.pause();
		this.completionResolve?.();
		this.active = false;
	}

	public cancel(): void {
		if (this.active) {
			this.cancelAction();
		}
		this.gestureFilter.pause();
		this.active = false;
	}

	protected abstract cancelAction(): void;
}

export abstract class ModeTool extends InteractiveToolBase {
	public get type(): ToolType.Mode { return ToolType.Mode; }

	public bind(): void {
		this.gestureFilter.resume();
	}

	public unbind(): void {
		this.gestureFilter.pause();
	}
}

export abstract class InstantaneousTool extends ToolBase {
	public get type(): ToolType.Instantaneous { return ToolType.Instantaneous; }

	public abstract execute(): void;
}