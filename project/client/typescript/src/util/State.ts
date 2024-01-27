import { Logger } from "../Logger.js";
import { None, Option, clone, getObjectID } from "./Utils.js";

// eslint-disable-next-line @typescript-eslint/ban-types
export type SkipReadonly = undefined | null | boolean | string | number | symbol | Function | URL | DOMMatrixReadOnly | DOMPointReadOnly;

type ROAction<T> = (_: DeepReadonly<T>) => void;
type ROMap<T, U> = (_: DeepReadonly<T>) => U;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StateTuple<T extends any[]> = { [K in keyof T]: State<T[K]> };

export type DeepReadonly<T> = T extends SkipReadonly ? T
	: T extends (infer U)[] ? ReadonlyArray<DeepReadonly<U>>
	: { readonly [K in keyof T]: DeepReadonly<T[K]> };

export interface WatchHandle {
	end(): void;
	poll(): this;
}

export function stateWithSetterOf<T>(value: T) {
	const state = new _MutableState(value);
	return {
		state: state as State<T>,
		setter: state.set
	};
}

export function mutableStateOf<T>(value: T) {
	return new _MutableState(value) as MutableState<T>;
}

export function mutableStateOfNone<T>(): MutableState<Option<T>> {
	return mutableStateOf<Option<T>>(None);
}

export function stateBy<T>(value: T, executor: (f: ROAction<T>) => void) {
	const state = new _MutableState(value);
	executor(state.set.bind(state));
	return state as State<T>;
}

export function deadStateOf<T>(value: T): State<T> {
	return new DeadState(value);
}

export function deferredStateOf<T>(value: T): DeferredState<T> {
	return new _DeferredState(value);
}

export function collectStateOf<T extends object>(value: T): State<Stateless<T>> {
	return new CollectedState(value);
}

const watchWeak = Symbol();

// @ts-expect-error watcher maps will still recieve the type they watched
export abstract class State<out T> {
	private watchers = new Map<number, ROAction<T>>();
	private weakWatchers = new Map<number, WeakRef<ROAction<T>>>();

	protected constructor(private value: T) { }
	public get() {
		return this.value as DeepReadonly<T>;
	}

	public getSnapshot(): T {
		return clone(this.value);
	}

	protected update(value: DeepReadonly<T>) {
		this.value = value as T;
		for (const f of this.weakWatchers.values()) {
			f.deref()?.(value);
		}
		for (const f of this.watchers.values()) {
			setTimeout(f, 0, value);
		}
	}

	public watch(f: ROAction<T>): WatchHandle {
		const id = getObjectID(f);
		this.watchers.set(id, f);
		const handle = {
			end: this.removeWatcher.bind(this, id),
			poll: () => (
				f(this.get()), handle
			)
		};
		return handle;
	}

	public [watchWeak](f: ROAction<T>): WatchHandle {
		const id = getObjectID(f);
		this.weakWatchers.set(id, new WeakRef(f));
		this.weakRemover.register(f, id, f);
		const handle = {
			end: this.removeWeak.bind(this, id),
			poll: () => (
				f(this.get()), handle
			)
		};
		return handle;
	}

	private weakRemover = new FinalizationRegistry((id: number) => this.removeWeak(id));

	private removeWatcher(id: number) {
		this.watchers.delete(id);
	}

	private removeWeak(id: number) {
		this.weakWatchers.delete(id);
	}

	public derived<U>(f: ROMap<T, U>): State<U> {
		return new DerivedState(this, f);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public derivedT<T extends any[], U>(this: State<T>, f: (..._: { readonly [K in keyof T]: DeepReadonly<T[K]> }) => U): State<U> {
		// @ts-expect-error technically this is a slightly different type
		return this.derived(l => f(...l));
	}

	public inspect<U>(f: ROMap<T, U>): U {
		return f(this.get());
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public with<U extends any[]>(...others: StateTuple<U>): State<[T, ...U]> {
		const list: StateTuple<[T, ...U]> = [this, ...others];
		return new CombinedState<[T, ...U]>(list);
	}

	public debug(logger: Logger, msg?: string): this {
		this.watch(v => logger.debug(msg ?? "", v));
		return this;
	}
}

function compose<T, U, V>(f1: (_: T) => U, f2: (_: U) => V): (_: T) => V {
	return t => f2(f1(t));
}

class DerivedState<T, U> extends State<U> {
	#_c: unknown;
	public constructor(
		private source: State<T>,
		private map: ROMap<T, U>,
	) {
		super(map(source.get()) as U);
		const callback = (v: DeepReadonly<T>) => this.update(map(v) as DeepReadonly<U>);
		source[watchWeak](callback);
		this.#_c = callback;
	}

	public override derived<V>(f: ROMap<U, V>): State<V> {
		return new DerivedState(this.source, compose(this.map as (_: DeepReadonly<T>) => DeepReadonly<U>, f));
	}
}

export abstract class MutableState<T> extends State<T> {
	public constructor(value: T) {
		super(value);
	}

	public set(value: DeepReadonly<T>) {
		this.update(value);
	}

	updateBy(f: (_: T) => T): void {
		const currentVal = this.get() as T;
		const newVal = f(currentVal) ?? currentVal;
		this.update(newVal as DeepReadonly<T>);
	}
}

class _MutableState<T> extends MutableState<T> { }

class DeadState<T> extends State<T> {
	public constructor(value: T) { super(value); }
	public override watch(f: ROAction<T>): WatchHandle {
		const handle = { end() { }, poll: () => (f(this.get()), handle) };
		return handle;
	}

	public override derived<U>(f: ROMap<T, U>): State<U> {
		return new DeadState(f(this.get()));
	}
}

export abstract class DeferredState<T> extends State<T> {
	public constructor(value: T) { super(value); }

	#_c?: unknown;

	public bind(target: State<T>) {
		const callback = this.update.bind(this);
		target[watchWeak](callback);
		this.#_c = callback;
		this.update(target.get());
	}
}
class _DeferredState<T> extends DeferredState<T> { }

export type Stateless<T> = T extends State<infer S> ? S
	: T extends SkipReadonly ? T
	: T extends object ? {
		readonly [K in keyof T]: Stateless<T[K]>
	}
	: T;

function eliminateState<T extends object>(value: T, onChange: () => void): Stateless<T> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const out = {} as any;
	for (const name of Object.getOwnPropertyNames(value)) {
		// @ts-expect-error why
		const val = value[name];
		if (val instanceof State) {
			val.watch(v => {
				out[name] = v;
				onChange();
			});
			out[name] = val.get();
		} else if (typeof val == "object") {
			out[name] = eliminateState(val, onChange);
		} else {
			out[name] = val;
		}
	}
	return out;
}

class CollectedState<T extends object> extends State<Stateless<T>> {
	public constructor(value: T) {
		super(
			eliminateState(value, () => this.update(this.get()))
		);
	}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class CombinedState<T extends any[]> extends MutableState<T> {
	#handles: unknown[];
	public constructor(
		values: StateTuple<T>,
	) {
		const out = [];
		const handles = [];
		for (let idx = 0; idx < values.length; idx++) {
			const value = values[idx];
			handles.push(value);
			out.push(value.get());
			const handle = value[watchWeak](v => {
				this.updateBy(l => ((l[idx] = v), l));
			});
			handles.push(handle);
		}
		super(out as T);
		this.#handles = handles;
	}
}
