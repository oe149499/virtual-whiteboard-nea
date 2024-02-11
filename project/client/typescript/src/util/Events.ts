import { Logger } from "../Logger.js";
import { None, Option, Some } from "./Utils.js";
const logger = new Logger("util/Events");

interface EventSchema {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[x: string]: (..._: any) => void;
}

// export enum DispatchMode {
// 	SingleTarget,
// 	MultiTarget,
// }

export function singleTargetProvider<T extends EventSchema>() {
	return new EventProvider<T, SingleTargetDispatcher<T>>(new SingleTargetDispatcher());
}

export function multiTargetProvider<T extends EventSchema>() {
	return new EventProvider<T, MultiTargetDispatcher<T>>(new MultiTargetDispatcher());
}

export function keyedProvider<TKey, T extends EventSchema>() {
	return new EventProvider<KeyedSchema<T, TKey>, KeyedDispatcher<T, TKey>>(new KeyedDispatcher());
}

export function exclusiveProvider<Params extends unknown[], Return>() {
	return new ExclusiveProvider<Params, Return>();
}

export class EventProvider<T extends EventSchema, D extends EventDispatcherBase<T>> {
	public constructor(
		public readonly dispatcher: D,
	) { }

	public emit<N extends keyof T>(name: N, ...params: Parameters<T[N]>) {
		this.dispatcher[call](name, params);
	}
}

const call = Symbol("call");

abstract class EventDispatcherBase<T extends EventSchema> {
	public abstract [call]<N extends keyof T>(name: N, params: Parameters<T[N]>): void;
}

class SingleTargetDispatcher<T extends EventSchema> extends EventDispatcherBase<T> {
	private callbacks: Option<T> = None;

	public override[call]<N extends keyof T>(name: N, params: Parameters<T[N]>): void {
		if (this.callbacks === None) return;
		this.callbacks[name].call(null, ...params);
	}

	public bind(handlers: T) {
		if (this.callbacks === None) this.callbacks = handlers;
		else logger.throw("Attempted to bind handler multiple times");
	}
}

class MultiTargetDispatcher<T extends EventSchema> extends EventDispatcherBase<T> {
	private callbacks: {
		[K in keyof T]?: T[K][]
	} = {};

	public override[call]<N extends keyof T>(name: N, params: Parameters<T[N]>): void {
		if (name in this.callbacks) {
			for (const cb of this.callbacks[name]!) {
				cb.call(null, ...params);
			}
		}
	}

	public connect<N extends keyof T>(name: N, callback: T[N]) {
		this.callbacks[name] ??= [];
		this.callbacks[name]!.push(callback);
	}
}

type KeyedSchema<T extends EventSchema, TKey> = { [K in keyof T]: KeyedCb<T, TKey, K> }
type KeyedCb<T extends EventSchema, TKey, N extends keyof T> = T[N] extends (...args: infer P) => void ? (key: TKey, ...args: P) => void : never;
type KeyedParams<T extends EventSchema, TKey, N extends keyof T> = Parameters<KeyedCb<T, TKey, N>>;

class KeyedDispatcher<T extends EventSchema, TKey> extends EventDispatcherBase<KeyedSchema<T, TKey>> {
	private callbacks = new Map<TKey, T>();

	public override[call]<N extends keyof T>(name: N, [key, ...params]: KeyedParams<T, TKey, N>): void {
		const cb = this.callbacks.get(key);
		if (!cb) return;
		cb[name](...params);
	}

	public register(key: TKey, handlers: T) {
		this.callbacks.set(key, handlers);
	}
}

// type DispatcherType<T extends EventSchema, M extends DispatchMode> = {
// 	[DispatchMode.SingleTarget]: SingleTargetDispatcher<T>,
// 	[DispatchMode.MultiTarget]: MultiTargetDispatcher<T>,
// }[M];

// const Dispatchers = {
// 	[DispatchMode.SingleTarget]: SingleTargetDispatcher,
// 	[DispatchMode.MultiTarget]: MultiTargetDispatcher,
// } as const;
const NoHandler = Symbol("NoHandler");

class ExclusiveProvider<Params extends unknown[], Return> {
	public readonly dispatcher = new ExclusiveDispatcher<Params, Return>();

	public call(...params: Params): Return {
		const res = this.dispatcher[call](params);
		if (res === NoHandler) return logger.throw("Tried to call an exclusive event with no handler");
		return res;
	}
}

class ExclusiveDispatcher<Params extends unknown[], Return> {
	private handler: Option<(..._: Params) => Return> = None;

	public [call](params: Params): Return | typeof NoHandler {
		if (Some(this.handler)) return this.handler(...params);
		return NoHandler;
	}

	public bind(handler: (..._: Params) => Return) {
		if (Some(this.handler)) logger.throw("Tried to bind an already-bound exclusive event");
		this.handler = handler;
	}
}