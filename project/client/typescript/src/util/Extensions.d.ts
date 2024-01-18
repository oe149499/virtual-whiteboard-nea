interface DOMTokenList {
	set(name: string, value: boolean): void;
}

interface HTMLElement {

	createChild<K extends keyof HTMLElementTagNameMap>(tagName: K): HTMLElementTagNameMap[K];
}

interface SVGElement {
	createChild<K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K];
}

interface Element {
	addClasses(...classes: string[]): this;

	setAttrs(attrs: { [K in keyof this]?: string | number | this[K] }): this;

	setContent(content: string): this;
}

interface Promise<T> {
	maxTimeout(time: number): Promise<import("../gen/Types").Result<T, number>>;
}