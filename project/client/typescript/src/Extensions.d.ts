interface DOMTokenList {
	set(name: string, value: boolean): void;
}

interface HTMLElement {
	addClasses(...classes: string[]): this;

	createChild<K extends keyof HTMLElementTagNameMap>(tagName: K): HTMLElementTagNameMap[K];

	setAttrs(attrs: object): this;

	setContent(content: string): this;
}