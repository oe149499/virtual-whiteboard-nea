import { Logger } from "../Logger.js";
import { Point, Result } from "../gen/Types.js";
import "./ExtensionsImpl.js";
import "./FirefoxPatch.js";
const logger = new Logger("util/Utils");

export const None = Symbol("None");
export type None = typeof None;

export type Option<T> = T | None;

export type Some<T> = T extends Option<infer U> ? U : T;
export function Some<T>(x: Option<T>): x is T {
	return x !== None;
}

export const QUERY_PARAMS = new URLSearchParams(window.location.href);

export type PromiseHandle<T> = {
	resolve: (_: T) => void,
	reject: (_: unknown) => void,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Constructor<T> = abstract new (...args: any) => T;

export function ok<T, TErr>(res: Result<T, TErr>): res is { status: "Ok", value: T } {
	if (res.status == "Ok") {
		return true;
	} else if (res.status == "Err") {
		return false;
	} else {
		todo();
	}
}

function removeStatus<T>(res: { status: string, value: T }): T {
	return res.value;
}

export function unwrap<T, TErr>(res: Result<T, TErr>, f?: (_: TErr) => T): T {
	if (ok(res)) {
		return removeStatus(res);
	} else {
		const err = removeStatus(res);
		if (f != undefined) {
			return f(err);
		} else {
			throw new Error(`unwrap() called on an error value: ${err}`);
		}
	}
}

export function unwrapOption<T>(opt: Option<T>, or?: () => T): T {
	if (opt === None) {
		if (or) return or();
		else return logger.throw("unwrapOption() called on None");
	} else return opt;
}

export function todo(..._: unknown[]): never {
	throw new Error("Not yet implemented");
}

export function point(x?: number, y?: number): Point {
	x ??= 0;
	y ??= x;
	return { x, y };
}

export function deg2rad(val: number) {
	return (val / 180) * Math.PI;
}

export function rad2deg(val: number) {
	return (val / Math.PI) * 180;
}

const objectIDs = new WeakMap<object, number>();
let nextObjID = 0;

export function getObjectID(o?: object): number {
	if (!o) return ++nextObjID;
	return objectIDs.get(o) ?? createObjectID(o);
}

function createObjectID(o: object) {
	const id = ++nextObjID;
	objectIDs.set(o, id);
	return id;
}

export function* rangeInclusive(min: number, max: number): Iterable<number> {
	for (let v = min; v <= max; v++) yield v;
}

export class OwnedInterval {
	public constructor(
		private fn: () => void,
		timeout: number,
	) {
		const fnWeak = new WeakRef(fn);

		const id = setInterval(() => {
			const fn = fnWeak.deref();
			if (!fn) clearInterval(id);
			else fn();
		}, timeout);
	}
}