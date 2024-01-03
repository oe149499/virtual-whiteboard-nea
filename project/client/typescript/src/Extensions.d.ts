interface DOMTokenList {
	swap(from: string, to: string): boolean;
}

interface HTMLElement {
	addClasses(...classes: string[]): this;
}