import { Logger } from "../Logger.js";
import { clone } from "./Clone.js";
import { None, Option, getObjectID } from "./Utils.js";

export const BlockDeepReadonly = Symbol("BlockReadonly");
export const ReadonlyAs = Symbol("ReadonlyAs");

/// Hardcoded list of basic readonly types
// eslint-disable-next-line @typescript-eslint/ban-types
export type SkipReadonly = undefined | null | boolean | string | number | symbol | Function | URL | Promise<unknown>;

/// This type and any subtype of it is already readonly
interface BlockReadonly {
	[BlockDeepReadonly]?: unknown;
}

/// This type and any subtype of it has a readonly supertype of T
export interface ReadonlyAs<T> {
	[ReadonlyAs]?(): T;
}


/// Interfaces which are already readonly can skip the recursive process
declare global {
	interface ReadonlyArray<T> extends ReadonlyAs<ReadonlyArray<T>> { }

	interface ReadonlySet<T> extends ReadonlyAs<ReadonlySet<T>> { }

	interface ReadonlyMap<K, V> extends ReadonlyAs<ReadonlyMap<K, V>> { }

	interface DOMMatrixReadOnly extends ReadonlyAs<DOMMatrixReadOnly> { }

	interface DOMPointReadOnly extends ReadonlyAs<DOMPointReadOnly> { }

	interface DOMRectReadOnly extends ReadonlyAs<DOMRectReadOnly> { }
}

type ROAction<T> = (_: DeepReadonly<T>) => void;
type ROMap<T, U> = (_: DeepReadonly<T>) => U;
type StateTuple<T extends unknown[]> = { [K in keyof T]: State<T[K]> };

export type DeepReadonly<T> = T extends SkipReadonly ? T
	: T extends ReadonlyAs<infer U> ? U : T extends BlockReadonly ? T
	// eslint-disable-next-line @stylistic/indent
	: { readonly [K in keyof T]: DeepReadonly<T[K]> };

export interface WatchHandle {
	end(): void;
	poll(): this;
}

export function mutableStateOf<T>(value: T) {
	return new MutableState(value);
}

/// This is common (and awkwardly verbose) enough to warrant a helper
export function mutableStateOfNone<T>() {
	return mutableStateOf<Option<T>>(None);
}

export function stateBy<T>(value: T, executor: (f: (_: T) => void) => void) {
	const state = new MutableState(value);
	executor(state.set.bind(state));
	return state as State<T>;
}

export function deadStateOf<T>(value: T): State<T> {
	return new DeadState(value);
}

export function deferredStateOf<T>(value: T): DeferredState<T> {
	return new _DeferredState(value);
}

export type MaybeState<T> = T | State<T>;

export function valueOf<T>(from: MaybeState<T>): DeepReadonly<T> {
	return from instanceof State ? from.get() : from as DeepReadonly<T>;
}

type MaybeStateArray<T> = { [K in keyof T]: MaybeState<T[K]> }

const keepaliveMap = new WeakMap();

export function collectMaybeState<T extends unknown[]>(...source: MaybeStateArray<T>) {
	const handles = [] as unknown[];

	const out = <T>source.map((val, index) => {
		if (val instanceof State) {
			const handle = val[watchWeak](value => {
				state.updateBy(a => a[index] = value);
			});
			handles.push(handle);
			return val.get();
		} else {
			return val;
		}
	});

	const state = new MutableState(out);
	keepaliveMap.set(state, handles);

	return state;
}

export const watchWeak = Symbol();

type MaybeParameters<T> = T extends (...args: infer P) => void ? P : never;
type MaybeReturnType<T> = T extends (...args: infer _) => infer R ? R : never;

/// While the watchers may expect a more specific type than T, the only way
/// for them to be submitted is if the real type of the state is actually that specific type
// @ts-expect-error ^^^
export abstract class State<out T> {
	[ReadonlyAs]?(): State<T>;
	private watchers = new Map<number, ROAction<T>>();
	private weakWatchers = new Map<number, WeakRef<ROAction<T>>>();

	protected constructor(protected value: T) { }
	public get() {
		return this.value as DeepReadonly<T>;
	}

	public getSnapshot(): T {
		return clone(this.value);
	}

	protected update(value: DeepReadonly<T> = this.value as DeepReadonly<T>) {
		this.value = value as T;
		for (const f of this.weakWatchers.values()) {
			f.deref()?.(value);
		}
		for (const f of this.watchers.values()) {
			queueMicrotask(() => f(value));
		}
	}

	public watch(f: ROAction<T>): WatchHandle {
		const id = getObjectID(f);
		this.watchers.set(id, f);
		const handle = {
			end: this.removeWatcher.bind(this, id),
			poll: () => (
				f(this.get()), handle
			),
		};
		return handle;
	}

	private static WatchOnMap = new WeakMap<object, unknown[]>();

	public watchOn(o: object, f: ROAction<T>) {
		const handle = this[watchWeak](f);
		const entry = State.WatchOnMap.get(o);
		if (entry === undefined) State.WatchOnMap.set(o, [handle]);
		else entry.push(handle);
	}

	public [watchWeak](f: ROAction<T>): WatchHandle {
		const id = getObjectID(f);
		this.weakWatchers.set(id, new WeakRef(f));
		const handle = {
			end: this.removeWeak.bind(this, id),
			poll: () => (
				f(this.get()), handle
			),
		};
		return handle;
	}

	private removeWatcher(id: number) {
		this.watchers.delete(id);
	}

	private removeWeak(id: number) {
		this.weakWatchers.delete(id);
	}

	public derived<U>(f: ROMap<T, U>): State<U> {
		return new DerivedState(this, f);
	}

	public derivedI<T extends object, N extends keyof T>(this: State<T>, name: N, ...args: MaybeParameters<T[N]>): State<MaybeReturnType<T[N]>> {
		// @ts-expect-error this is beyond typescript's inference capabilities
		return this.derived(v => v[name](...args));
	}

	public derivedT<T extends unknown[], U>(this: State<T>, f: (..._: { readonly [K in keyof T]: DeepReadonly<T[K]> }) => U): State<U> {
		// @ts-expect-error This is sound as long as DeepReadonly<T> is a supertype of T, which should be the case
		return this.derived(l => f(...l));
	}

	public flatten(this: State<State<T>>): State<T> {
		return new FlattenedState(this);
	}

	public inspect<U>(f: ROMap<T, U>): U {
		return f(this.get());
	}

	public with<U extends unknown[]>(...others: StateTuple<U>): State<[T, ...U]> {
		const list: StateTuple<[T, ...U]> = [this, ...others];
		return new CombinedState<[T, ...U]>(list);
	}

	public debug(logger: Logger, msg?: string): this {
		this.watch(v => logger.debug(msg ?? "", v));
		return this;
	}
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
}

export abstract class MutableTransformer<T, U> {
	public abstract forwards(src: DeepReadonly<T>): U;
	public abstract backwards(src: DeepReadonly<U>): T;

	public inverse(): MutableTransformer<U, T> {
		return new InverseTransformer(this);
	}
}

class InverseTransformer<T, U> extends MutableTransformer<U, T> {
	public constructor(private inner: MutableTransformer<T, U>) { super(); }

	public override forwards(src: DeepReadonly<U>): T {
		return this.inner.backwards(src);
	}

	public override backwards(src: DeepReadonly<T>): U {
		return this.inner.forwards(src);
	}
}

export abstract class MutableExtractor<T, U> {
	public abstract get(src: T): U;
	public abstract patch(src: U, target: T): T;
}

class FieldExtractor<T, N extends keyof T> extends MutableExtractor<T, T[N]> {
	public constructor(private field: N) { super(); }

	public override get(src: T): T[N] {
		return src[this.field];
	}

	public override patch(src: T[N], target: T): T {
		target[this.field] = src;
		return target;
	}
}

export class MutableState<T> extends State<T> {
	public constructor(value: T) {
		super(value);
	}

	public set(value: T) {
		this.update(value as DeepReadonly<T>);
	}

	public updateBy(f: (_: T) => T): void {
		const currentVal = this.value;
		const newVal = f(currentVal) ?? currentVal;
		this.set(newVal);
	}

	public mutate(f: (_: T) => void) {
		const currentVal = this.value;
		f(currentVal);
		this.set(currentVal);
	}

	public derivedM<U>(transformer: MutableTransformer<T, U>): MutableState<U> {
		return new MutableDerived(this, transformer);
	}

	public extract<U>(extractor: MutableExtractor<T, U>): MutableState<U>;
	public extract<N extends keyof T>(field: N): MutableState<T[N]>;
	public extract<U, N extends keyof T>(extractorOrField: N | MutableExtractor<T, U>) {
		if (extractorOrField instanceof MutableExtractor) {
			return new MutableExtracted(this, extractorOrField);
		} else {
			return new MutableExtracted(this, new FieldExtractor(extractorOrField));
		}
	}
}

class MutableDerived<T, U> extends MutableState<U> {
	#handle: unknown;
	public constructor(
		private source: MutableState<T>,
		private transformer: MutableTransformer<T, U>,
	) {
		super(transformer.forwards(source.get()));
		this.#handle = source[watchWeak](value => {
			this.update(transformer.forwards(value) as DeepReadonly<U>);
		});
	}

	public override set(value: U) {
		this.update(value as DeepReadonly<U>);
		this.source.set(this.transformer.backwards(value as DeepReadonly<U>));
	}
}

class MutableExtracted<T, U> extends MutableState<U> {
	#handle: unknown;
	public constructor(
		private source: MutableState<T>,
		private extractor: MutableExtractor<T, U>,
	) {
		super(extractor.get(source.get() as T));
		this.#handle = source[watchWeak](value => {
			this.update(extractor.get(value as T) as DeepReadonly<U>);
		});
	}

	public override set(value: U): void {
		const sourceVal = this.extractor.patch(value, this.source["value"]);
		this.source["update"](sourceVal as DeepReadonly<T>);
	}
}

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

class CombinedState<T extends unknown[]> extends MutableState<T> {
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

class FlattenedState<T> extends State<T> {
	#outerHandle: WatchHandle;
	private handle: WatchHandle;

	public constructor(
		private source: State<State<T>>,
	) {
		super(source.get().get() as T);

		const update = this.update.bind(this);

		this.handle = source.get()[watchWeak](update).poll();

		this.#outerHandle = source[watchWeak](state => {
			this.handle.end();
			this.handle = state[watchWeak](update).poll();
		});
	}
}