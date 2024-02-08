/* eslint-disable @typescript-eslint/no-explicit-any */

declare global {
	interface Object {
		[ClonerSym]?: Cloner<this>;
	}
}

type Cloner<T> = (old: T) => T;

const ClonerSym = Symbol("Cloner");

function register<T extends object>({ prototype }: { prototype: T }, fn: Cloner<T>) {
	prototype[ClonerSym] = fn as any;
}

export function clone<T>(value: T): T {
	if (typeof value == "object") {
		if (value === null) return value;
		if (ClonerSym in value) {
			const cloner = value[ClonerSym];
			return cloner(value) as T;
		}

		const proto = Object.getPrototypeOf(value);

		const props = Object.getOwnPropertyDescriptors(value);

		return Object.create(proto, props);
	}
	return value;
}

register(DOMMatrixReadOnly, m => m.scale(1));