import { Point, Result } from "../gen/Types.js";

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
			out[name] = value[name];
		}
		Object.setPrototypeOf(out, Object.getPrototypeOf(value));
		return out as T;
	}
	return value;
}

export async function* asyncMap<TIn, TOut>(src: AsyncIterator<TIn>, f: (_: TIn) => TOut): AsyncIterator<TOut> {
	while (true) {
		const { done, value } = await src.next();
		if (done) return;
		else yield f(value);
	}
}

export async function* dechunk<T>(i: AsyncIterable<T[]>): AsyncIterable<T> {
	for await (const chunk of i) {
		for (const item of chunk) {
			yield item;
		}
	}
}

export function getIter<T>(i: AsyncIterable<T> | Iterable<T>): AsyncIterator<T> {
	if (Symbol.asyncIterator in i) {
		return i[Symbol.asyncIterator]();
	} else {
		const iter = i[Symbol.iterator]();
		return {
			next: () => Promise.resolve(iter.next()),
		};
	}
}

export async function* zip<L, R>(l: AsyncIterable<L> | Iterable<L>, r: AsyncIterable<R> | Iterable<R>): AsyncIterable<[L, R]> {
	const iterL = getIter(l);
	const iterR = getIter(r);
	while (true) {
		const [il, ir] = await Promise.all([iterL.next(), iterR.next()]);
		if (il.done || ir.done) {
			return;
		} else {
			yield [il.value, ir.value];
		}
	}
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

export async function splitFirstAsync<T>(iter: AsyncIterable<T>): Promise<[T, AsyncIterable<T>]> {
	const iterator = iter[Symbol.asyncIterator]();
	const first = await iterator.next();
	const rest = { [Symbol.asyncIterator]: () => iterator };
	return [first.value, rest];
}

function unpackPromise<T, U>(p: Promise<[T, U]>): [Promise<T>, Promise<U>] {
	return [
		p.then(([t, _]) => t),
		p.then(([_, u]) => u),
	];
}

export function peekFirstAsync<T>(iter: AsyncIterable<T>): [Promise<T>, AsyncIterable<T>] {
	const [first, rest] = unpackPromise(splitFirstAsync(iter));
	const rIter = rest.then(r => r[Symbol.asyncIterator]());
	let useFirst = true;
	return [first, {
		[Symbol.asyncIterator]() {
			return {
				next() {
					if (useFirst) {
						useFirst = false;
						return first.then(value => ({ value }));
					} else {
						return rIter.then(i => i.next());
					}
				}
			};
		}
	}];
}

export function wrapIterAsync<T>(iter: AsyncIterator<T>): AsyncIterable<T> {
	return {
		[Symbol.asyncIterator]() { return iter; }
	};
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