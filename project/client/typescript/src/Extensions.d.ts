interface DOMTokenList {
	swap(from: string, to: string): boolean;
}

interface HTMLElement {
	addClasses(...classes: string[]): this;

	createChild<K extends keyof HTMLElementTagNameMap>(tagName: K): HTMLElementTagNameMap[K];
}