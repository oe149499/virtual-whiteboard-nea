/* eslint-disable @typescript-eslint/no-explicit-any */

import { PrototypeMap } from "./Maps.js";


const ClonerTable = new PrototypeMap<any, any>();

type Cloner<T> = (old: T) => T;

function register<T extends object>(cls: abstract new (..._: any[]) => T, fn: Cloner<T>) {
	ClonerTable.setClass(cls, fn);
}

export function clone<T>(value: T): T {
	if (typeof value == "object") {
		if (value === null) return value;
		for (const cloner of ClonerTable.get(value)) {
			return cloner(value);
		}

		const proto = Object.getPrototypeOf(value);

		const props = Object.getOwnPropertyDescriptors(value);

		return Object.create(proto, props);
	}
	return value;
}

register(DOMMatrixReadOnly, m => m.translate());
register(SVGMatrix, m => m.translate());