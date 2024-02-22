import { watchWeak } from "./State.js";
import { mutableStateOf, type DeepReadonly, State, type MutableState } from "./State.js";

export class StateSet<T> extends State<Set<T>> {
	public readonly size = this.derived(s => s.size);

	// protected constructor(protected _inner: State<Set<T>>) {
	// 	this.size = _inner.derived(s => s.size);
	// }



	public has(value: T) {
		return this.derivedI("has", value);
	}

	public map<U>(fn: (_: DeepReadonly<T>) => U): StateSet<U> {
		return new DerivedStateSet(this, fn);
	}
}

class DerivedStateSet<T, U> extends StateSet<U> {
	#handle: unknown;
	public constructor(source: StateSet<T>, fn: (_: DeepReadonly<T>) => U) {
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

export class MutableStateSet<T> extends StateSet<T> {
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