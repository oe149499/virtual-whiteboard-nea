interface DOMTokenList {
	set(name: string, value: boolean): void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PropertyMap<T> = { [K in keyof T]?: string | number | T[K] };

interface HTMLElement {

	createChild<K extends keyof HTMLElementTagNameMap>(tagName: K): HTMLElementTagNameMap[K];
}

interface SVGElement {
	createChild<K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K];
}

interface Element {
	addClasses(...classes: string[]): this;

	setAttrs(attrs: PropertyMap<this>): this;

	setContent(content: string): this;
}