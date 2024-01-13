import { getObjectID } from "./Utils";

type Action<T> = (_: T) => void;

export interface WatchHandle {
	end(): void;
}

export interface State<T> {
	get(): T;
	watch(f: Action<T>): WatchHandle;
	watchWeak(f: Action<T>): WatchHandle;
	derived<U>(f: (_: T) => U): State<U>;
}

export interface MutableState<T> extends State<T> {
	set(value: T): void;
}

export function stateWithSetterOf<T>(value: T) {
	const state = new StateCell(value);
	return {
		state: state as State<T>,
		setter: state.set
	};
}

export function mutableStateOf<T>(value: T) {
	return new StateCell(value) as MutableState<T>;
}

export function stateBy<T>(value: T, executor: (f: Action<T>) => void) {
	const state = new StateCell(value);
	executor(state.set.bind(state));
	return state as State<T>;
}

abstract class StateProvider<T> implements State<T> {
	private watchers = new Map<number, Action<T>>();
	private weakWatchers = new Map<number, WeakRef<Action<T>>>();

	protected constructor(private value: T) { }
	public get() {
		return this.value;
	}

	protected update(value: T) {
		this.value = value;
		for (const f of this.watchers.values()) {
			f(value);
		}
		for (const f of this.weakWatchers.values()) {
			f.deref()?.(value);
		}
	}

	public watch(f: Action<T>): WatchHandle {
		const id = getObjectID(f);
		this.watchers.set(id, f);
		return { end: this.removeWatcher.bind(this, id) };
	}

	public watchWeak(f: Action<T>): WatchHandle {
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

	public derived<U>(f: (_: T) => U): State<U> {
		return new DerivedState(this, f);
	}
}

function compose<T, U, V>(f1: (_: T) => U, f2: (_: U) => V): (_: T) => V {
	return t => f2(f1(t));
}

class DerivedState<T, U> extends StateProvider<U> {
	#_c: unknown;
	public constructor(
		private source: State<T>,
		private map: (_: T) => U,
	) {
		super(map(source.get()));
		const callback = (v: T) => this.update(map(v));
		source.watchWeak(callback);
		this.#_c = callback;
	}

	public override derived<V>(f: (_: U) => V): State<V> {
		return new DerivedState(this.source, compose(this.map, f));
	}
}

class StateCell<T> extends StateProvider<T> implements MutableState<T> {
	public constructor(value: T) {
		super(value);
	}
	public set(value: T) {
		this.update(value);
	}
}