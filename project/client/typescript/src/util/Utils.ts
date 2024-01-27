import { Logger } from "../Logger.js";
import { Point, Result, Transform } from "../gen/Types.js";
import { State } from "./State.js";
import "./ExtensionsImpl.js";
const logger = new Logger("util/Utils");

export const None = Symbol("None");
export type None = typeof None;

export type Option<T> = T | None;

export type PromiseHandle<T> = {
	resolve: (_: T) => void;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	reject: (_: any) => void;
}

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

export function unwrap<T, TErr>(res: Result<T, TErr>, f?: (_: TErr) => T | never): T {
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

export function todo(): never {
	throw new Error("Not yet implemented");
}

export function point(x?: number, y?: number): Point {
	x ??= 0;
	y ??= x;
	return { x, y };
}

export function clone<T>(value: T): T {
	if (typeof value == "object") {
		const out = {};
		for (const name of Object.getOwnPropertyNames(value)) {
			// @ts-expect-error assigning nonexistent properties
			out[name] = clone(value[name]);
		}
		Object.setPrototypeOf(out, Object.getPrototypeOf(value));
		return out as T;
	}
	return value;
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
export function applyTransform(t: Transform, p: Point): Point {
	return {
		x: p.x + t.origin.x,
		y: p.y + t.origin.y,
	};
}

function updateMatrix(m: DOMMatrix, t: Transform) {
	const { x: a, y: b } = t.basisX;
	const { x: c, y: d } = t.basisY;
	const { x: e, y: f } = t.origin;

	Object.assign(m, { a, b, c, d, e, f });
}

export function asDomMatrix(t: Transform): DOMMatrix;
export function asDomMatrix(t: State<Transform>): State<DOMMatrixReadOnly>;
export function asDomMatrix(t: Transform | State<Transform>): DOMMatrix | State<DOMMatrixReadOnly> {
	const matrix = new DOMMatrix();

	if ("get" in t) {
		return t.derived(t => {
			updateMatrix(matrix, t);
			return matrix as DOMMatrixReadOnly;
		});
	} else {
		updateMatrix(matrix, t);
		return matrix;
	}
}