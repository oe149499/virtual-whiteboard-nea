import { BoundsTester } from "../Bounds";
import { Point, Result } from "../gen/Types";
import { State } from "./State";

declare global {
	type Handler<T> = ((_: T) => void) | null;

	interface DOMTokenList {
		set(name: string, value: boolean): void;

		setBy(name: string, source: State<boolean>): void;
	}

	interface DOMRectReadOnly extends BoundsTester { }

	interface HTMLElement {

		createChild<K extends keyof HTMLElementTagNameMap>(tagName: K): HTMLElementTagNameMap[K];
	}

	interface SVGElement {
		createChild<K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K];
	}

	interface SVGGraphicsElement {
		getFinalTransform(current?: DOMMatrix): DOMMatrix;

		getBBoxState(): State<SVGRect>;
	}

	interface Element {
		addClasses(...classes: string[]): this;

		setAttrs(attrs: { [K in keyof this]?: string | number | this[K] }): this;

		setContent(content: string): this;
	}

	interface Promise<T> {
		maxTimeout(time: number): Promise<Result<T, number>>;
	}

	interface WeakMap<K extends object, V> {
		has(value: unknown): value is K;
	}
}