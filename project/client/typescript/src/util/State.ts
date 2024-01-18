import { clone, getObjectID } from "./Utils.js";

// eslint-disable-next-line @typescript-eslint/ban-types
type Primitive = undefined | null | boolean | string | number | Function;

type ROAction<T> = (_: Readonly<T>) => void;
type ROMap<T, U> = (_: Readonly<T>) => U;
type Readonly<T> = T extends Primitive ? T
	: T extends (infer U)[] ? ReadonlyArray<Readonly<U>>
	: { readonly [K in keyof T]: Readonly<T[K]> };

export interface WatchHandle {
	end(): void;
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
	return new _CollectedState(value);
}

const watchWeak = Symbol();

export abstract class State<T> {
	private watchers = new Map<number, ROAction<T>>();
	private weakWatchers = new Map<number, WeakRef<ROAction<T>>>();

	protected constructor(private value: T) { }
	public get() {
		return this.value as Readonly<T>;
	}

	public getSnapshot(): T {
		return clone(this.value);
	}

	protected update(value: Readonly<T>) {
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
		return { end: this.removeWatcher.bind(this, id) };
	}

	public [watchWeak](f: ROAction<T>): WatchHandle {
		const id = getObjectID(f);
		this.weakWatchers.set(id, new WeakRef(f));
		this.weakRemover.register(f, id, f);
		return { end: this.removeWeak.bind(this, id) };
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
		const callback = (v: Readonly<T>) => this.update(map(v) as Readonly<U>);
		source[watchWeak](callback);
		this.#_c = callback;
	}

	public override derived<V>(f: ROMap<U, V>): State<V> {
		return new DerivedState(this.source, compose(this.map as (_: Readonly<T>) => Readonly<U>, f));
	}
}

export abstract class MutableState<T> extends State<T> {
	public constructor(value: T) {
		super(value);
	}

	public set(value: Readonly<T>) {
		this.update(value);
	}

	updateBy(f: (_: T) => T | undefined): void {
		const currentVal = this.get() as T;
		const newVal = f(currentVal) ?? currentVal;
		this.update(newVal as Readonly<T>);
	}
}

class _MutableState<T> extends MutableState<T> { }

class DeadState<T> extends State<T> {
	public constructor(value: T) { super(value); }
	public override watch(_f: ROAction<T>): WatchHandle {
		return { end() { } };
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

class _CollectedState<T extends object> extends State<Stateless<T>> {
	public constructor(value: T) {
		super(
			eliminateState(value, () => this.update(this.get()))
		);
	}
}