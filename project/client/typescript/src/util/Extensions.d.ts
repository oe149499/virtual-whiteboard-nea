import { BoundsTester } from "../Bounds";
import { Result, type Point } from "../gen/Types";
import { State, type ReadonlyAs, type DeepReadonly } from "./State";

type EventMap<E extends Element> = {
	[K in keyof E as (K extends `on${infer N}` ? N : never)]?: E[K]
}

declare global {
	type Handler<T> = ((_: T) => void) | null;

	interface Set<T> extends ReadonlyAs<ReadonlySet<T>> {
		addFrom(src: Iterable<T>): void;

		drain(): Iterable<T>;

		first(): T | undefined;
	}

	interface Map<K, V> {
		assume(key: K): V;
	}

	interface DOMTokenList {
		set(name: string, value: boolean): void;

		setBy(name: string, source: State<boolean>): void;

		select(ifTrue: string, ifFalse: string, value: boolean): void;

		selectBy(ifTrue: string, ifFalse: string, source: State<boolean>): void;
	}

	interface DOMPoint {
		getXY(): Point;
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

	interface PromiseWithResolvers<T> {
		promise: Promise<T>;
		resolve: (value: T | PromiseLike<T>) => void;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		reject: (reason?: any) => void;
	}

	interface PromiseConstructor {
		withResolvers<T>(): PromiseWithResolvers<T>;
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