import { watchWeak } from "./State.js";
import { type DeepReadonly, State } from "./State.js";

// @ts-expect-error same logic as State<T>
abstract class _StateSet<out T> extends State<Set<T>>{
	public readonly size = this.derived(s => s.size);

	public has(value: T) {
		return this.derivedI("has", value);
	}

	public map<U>(fn: (_: DeepReadonly<T>) => U): _StateSet<U> {
		return new DerivedStateSet(this, fn);
	}
}

export type StateSet<T> = _StateSet<T> & State<Set<T>>;

class DerivedStateSet<T, U> extends _StateSet<U> {
	#handle: unknown;
	public constructor(source: _StateSet<T>, fn: (_: DeepReadonly<T>) => U) {
		const newSet = new Set<U>();
		super(newSet);

		// @ts-expect-error WeakMap will only be selected if T is an object type
		const mapCache = typeof this.value.first() === "object" ? new WeakMap<T, U>() : new Map<T, U>();

		this.#handle = source[watchWeak](s => {
			newSet.clear();
			for (const item of s) {
				const cachedVal = mapCache.get(item);
				if (cachedVal) newSet.add(cachedVal);
				else {
					const newVal = fn(item as DeepReadonly<T>);
					mapCache.set(item, newVal);
					newSet.add(newVal);
				}
			}
			this.update(newSet);
		});
	}
}

export class MutableStateSet<T> extends _StateSet<T> {
	// private inner: MutableState<Set<T>>;
	public constructor() {
		super(new Set());
	}

	public add(value: T) {
		const s = this.value;
		if (!s.has(value)) {
			s.add(value);
			this.update(s);
		}
	}

	public delete(value: T) {
		const ret = this.value.delete(value);
		if (ret) this.update();
		return ret;
	}

	public clear() {
		this.value.clear();
		this.update();
	}
}