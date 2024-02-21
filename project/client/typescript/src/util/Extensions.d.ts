import { BoundsTester } from "../Bounds";
import { Result } from "../gen/Types";
import { State, type ReadonlyAs, type DeepReadonly } from "./State";

type EventMap<E extends Element> = {
	[K in keyof E as (K extends `on${infer N}` ? N : never)]?: E[K]
}

declare global {
	type Handler<T> = ((_: T) => void) | null;

	interface Set<T> {
		addFrom(src: Iterable<T>): void;

		first(): T | undefined;
	}

	interface Map<K, V> {
		assume(key: K): V;
	}

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

		addHandlers(handlers: EventMap<this>): this;
	}

	interface Promise<T> {
		maxTimeout(time: number): Promise<Result<T, number>>;
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	interface WeakMap<K extends object, V> {
		has(value: unknown): value is K;
	}

	interface Object {
		asReadonly<T>(this: ReadonlyAs<T>): T;
	}
}