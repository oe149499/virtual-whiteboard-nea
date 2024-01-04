import { PromiseHandle } from "./Utils.js";

export class Channel<T> implements AsyncIterable<T> {
	private queue: T[] = [];

	private handles: PromiseHandle<T>[] = [];

	private handlePromises() {
		while (this.queue.length && this.handles.length) {
			const value = this.queue.shift() as T;
			const { resolve } = this.handles.shift() as PromiseHandle<T>;
			resolve(value);
		}
	}

	public push(value: T) {
		this.queue.push(value);
		this.handlePromises();
	}

	public pop(): Promise<T> {
		return new Promise((resolve, reject) => {
			this.handles.push({ resolve, reject });
			this.handlePromises();
		});
	}

	[Symbol.asyncIterator]() {
		return {
			next: () => this.pop().then(value => ({ value })),
		};
	}
}