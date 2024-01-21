import { Logger } from "../Logger.js";
import { Point, Result } from "../gen/Types.js";
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

export function getObjectID(o: object): number {
	return objectIDs.get(o) ?? createObjectID(o);
}

function createObjectID(o: object) {
	const id = ++nextObjID;
	objectIDs.set(o, id);
	return id;
}

const timeoutVal = Symbol();

async function maxTimeout<T>(this: Promise<T>, time: number): Promise<Result<T, number>> {
	const timeout = new Promise<typeof timeoutVal>(r => setTimeout(r.bind(undefined, timeoutVal), time));
	const val = await Promise.race([this, timeout]);
	if (val === timeoutVal) return {
		status: "Err",
		value: time,
	};
	else return {
		status: "Ok",
		value: val,
	};
}

Promise.prototype.maxTimeout = maxTimeout;

Element.prototype.addClasses = function (...classes) {
	for (const c of classes) {
		this.classList.add(c);
	}
	return this;
};

HTMLElement.prototype.createChild = function (tagname) {
	const elem = document.createElement(tagname);
	return this.appendChild(elem);
};

SVGElement.prototype.createChild = function (tagname) {
	const elem = document.createElementNS("http://www.w3.org/2000/svg", tagname);
	return this.appendChild(elem);
};

Element.prototype.setAttrs = function (attrs) {
	for (const name in attrs) {
		// @ts-expect-error I'M LITERALLY ITERATING OVER THE KEYS OF THE OBJECT
		this.setAttribute(name, attrs[name]);
	}
	return this;
};

Element.prototype.setContent = function (content) {
	this.textContent = content;
	return this;
};

DOMTokenList.prototype.set = function (name, value) {
	if (value) this.add(name);
	else this.remove(name);
};

const keepaliveMap = new WeakMap();

DOMTokenList.prototype.setBy = function (name, source) {
	const handle = source.watch(value => this.set(name, value));
	keepaliveMap.set(this, handle);
};