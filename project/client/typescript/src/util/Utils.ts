import { Result } from "../gen/Types";

export type PromiseHandle<T> = {
	resolve: (_: T) => void;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	reject: (_: any) => void;
}

export function ok<T, TErr>(res: Result<T, TErr>): res is { status: "Ok" } & T {
	if (res.status == "Ok") {
		return true;
	} else if (res.status == "Err") {
		return false;
	} else {
		todo();
	}
}

function removeStatus<T>(res: T & { status: string }): T {
	const { status: _, ...rest } = res;
	// @ts-expect-error Removing {status: ...} from T & {status: ...} is probably the same as T
	return rest;
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

export async function* asyncMap<TIn, TOut>(src: AsyncIterator<TIn>, f: (_: TIn) => TOut): AsyncIterator<TOut> {
	while (true) {
		const { done, value } = await src.next();
		if (done) return;
		else yield f(value);
	}
}

const objectID: unique symbol = Symbol("global object ID");
let nextObjID = 0;

export function getObjectID(_o: object): number {
	const o = _o as { [objectID]: number };
	if (objectID in o) return o[objectID];
	else {
		const id = ++nextObjID;
		// @ts-expect-error yes i'm aware that this doesn't exist yet
		o[objectID] = id;
		return id;
	}
}

HTMLElement.prototype.addClasses = function (...classes) {
	for (const c of classes) {
		this.classList.add(c);
	}
	return this;
};

HTMLElement.prototype.createChild = function (tagname) {
	const elem = document.createElement(tagname);
	this.appendChild(elem);
	return elem;
};

DOMTokenList.prototype.set = function (name, value) {
	if (value) this.add(name);
	else this.remove(name);
};