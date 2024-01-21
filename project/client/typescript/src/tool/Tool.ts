import type { Board } from "../Board.js";
import { AnyPropertyMap, AnyPropertyStore } from "../Properties.js";
import { DragGestureState, LongPressGesture, PressGesture } from "../canvas/Gesture.js";
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
	properties?: AnyPropertyMap
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
	readonly properties?: AnyPropertyMap;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
abstract class ToolBase implements _Tool {
	public abstract get type(): ToolType;
	protected get canvas() {
		return this.board.canvas;
	}

	protected init?(): void;

	public constructor(
		protected board: Board,
	) {
		this.init?.();
	}
}

type GestureHandlers = {
	drag: Handler<DragGestureState>,
	press: Handler<PressGesture>,
	longpress: Handler<LongPressGesture>,
};

abstract class InteractiveToolBase extends ToolBase {
	#gestureHandlers: GestureHandlers | null = null;

	private get gestureHandlers() {
		if (!this.#gestureHandlers) {
			const handlers: Partial<GestureHandlers> = {};
			handlers.drag = this.onDragGesture?.bind(this) ?? null;
			handlers.press = this.onPressGesture?.bind(this) ?? null;
			handlers.longpress = this.onLongPressGesture?.bind(this) ?? null;
			this.#gestureHandlers = handlers as GestureHandlers;
		}
		return this.#gestureHandlers;
	}

	protected onDragGesture?(gesture: DragGestureState): void;
	protected get dragHandler() { return this.gestureHandlers.drag; }

	protected onPressGesture?(gesture: PressGesture): void;
	protected get pressHandler() { return this.gestureHandlers.press; }

	protected onLongPressGesture?(gesture: LongPressGesture): void;
	protected get longPressHandler() { return this.gestureHandlers.longpress; }

	protected unbindGestures() {
		if (this.canvas.ondraggesture === this.dragHandler)
			this.canvas.ondraggesture = null;
		if (this.canvas.onpressgesture === this.pressHandler)
			this.canvas.onpressgesture = null;
		if (this.canvas.onlongpressgesture === this.longPressHandler)
			this.canvas.onlongpressgesture = null;

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