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

export function unwrap<T, TErr>({ status, value }: Result<T, TErr>, f?: (_: TErr) => T): T {
	if (status === "Ok") return value;
	else if (f !== undefined) return f(value);
	else throw new Error(`unwrap() called on an error value: ${value}`);
}

export function anyOf<T>(src: Iterable<T>, are: (_: T) => boolean) {
	for (const item of src) if (are(item)) return true;
	return false;
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

/** Get a unique ID tied to an object */
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

/** Run a callback only while this object exists */
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