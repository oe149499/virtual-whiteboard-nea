interface DOMTokenList {
	set(name: string, value: boolean): void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PropertyMap<T> = { [K in keyof T]?: T[K] extends string ? string | number : T[K] };

interface HTMLElement {
	addClasses(...classes: string[]): this;

	createChild<K extends keyof HTMLElementTagNameMap>(tagName: K): HTMLElementTagNameMap[K];

	setAttrs(attrs: PropertyMap<this>): this;

	setContent(content: string): this;
}