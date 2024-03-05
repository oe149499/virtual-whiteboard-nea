import { None, Option } from "./Utils.js";

export class AutoMap<K, V> extends Map<K, V> {
	public constructor(
		private fallback: (_: K) => V,
	) {
		super();
	}

	override get(key: K): V {
		const value = super.get(key);
		if (value === undefined) {
			const newVal = this.fallback(key);
			this.set(key, newVal);
			return newVal;
		}
		return value;
	}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor<T = any> = abstract new (..._: any) => T;

export class PrototypeMap<K, V> {
	private inner = new WeakMap<object, [Option<V>, Set<V>]>();

	private setProto(proto: object, value: V) {
		if (this.inner.has(proto)) {
			this.inner.get(proto)![0] = value;
		} else {
			this.inner.set(proto, [value, new Set()]);
		}
	}

	private addProto(proto: object, values: V[]) {
		const entry = this.inner.get(proto);
		if (entry) for (const value of values) {
			entry[1].add(value);
		} else {
			this.inner.set(proto, [None, new Set(values)]);
		}
	}

	private * getProto(proto: object) {
		let current = proto;
		while (current !== null) {
			const entry = this.inner.get(current);
			if (entry) {
				if (entry[0] !== None) yield entry[0];
				yield* entry[1];
			}
			current = Object.getPrototypeOf(current);
		}
	}

	public set(key: K, value: V) {
		this.setProto(Object.getPrototypeOf(key), value);
	}

	public setClass(key: Constructor<K>, value: V) {
		this.setProto(key.prototype, value);
	}

	public add(key: K, ...values: V[]) {
		this.addProto(Object.getPrototypeOf(key), values);
	}

	public addClass(key: Constructor<K>, ...values: V[]) {
		this.addProto(key.prototype, values);
	}

	public get(key: K) {
		return this.getProto(Object.getPrototypeOf(key));
	}

	public getClass(key: Constructor<K>) {
		return this.getProto(key.prototype);
	}
}

type HookCb<T, P, R> = (this: T, _: P) => R;

export class HookMap<T, P = void, R = void> {
	private inner = new PrototypeMap<T, HookCb<T, P, R>>();
	private chainCache = new Map<object, HookCb<T, P, R>[]>();

	public add<U extends T>(cls: Constructor<U>, cb: HookCb<U, P, R>) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		this.inner.addClass(cls, cb as any);
	}

	private getChain(value: T) {
		const proto = Object.getPrototypeOf(value);
		let chain = this.chainCache.get(proto);
		if (!chain) {
			chain = Array.from(this.inner.get(value)).reverse();
			this.chainCache.set(proto, chain);
		}
		return chain;
	}

	public trigger(value: T, param: P) {
		for (const cb of this.getChain(value)) {
			cb.call(value, param);
		}
	}

	public * collect(value: T, param: P) {
		for (const cb of this.getChain(value)) {
			yield cb.call(value, param);
		}
	}
}