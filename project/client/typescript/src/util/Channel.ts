import { PromiseHandle } from "./Utils.js";

export class Channel<T> implements AsyncIterable<T> {
	private queue: T[] = [];

	private handles: PromiseHandle<T>[] = [];

	private closed = false;

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
		if (this.closed) return Promise.reject("closed");
		return new Promise((resolve, reject) => {
			this.handles.push({ resolve, reject });
			this.handlePromises();
		});
	}

	public close() {
		this.closed = true;
		for (const handle of this.handles) handle.reject("closed");
	}

	[Symbol.asyncIterator]() {
		return {
			next: () => this.pop().then(value => ({ done: false, value }), () => ({ done: true, value: null as unknown as T })),
		};
	}
}