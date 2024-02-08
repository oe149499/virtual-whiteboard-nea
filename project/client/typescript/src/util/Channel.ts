import { AsyncIter } from "./AsyncIter.js";
import { PromiseHandle } from "./Utils.js";

const getIter = Symbol("getIter");

export function makeChannel<T>(): [Channel<T>, AsyncIter<T>] {
	const channel = new Channel<T>();
	return [channel, AsyncIter.of<T>(channel[getIter]())];
}

export class Channel<T> {
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

	private pop(): Promise<T> {
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

	public [getIter]() {
		return {
			next: () => this.pop().then(
				value => ({ done: false as const, value }),
				() => ({ done: true as const, value: 0 }),
			),
		};
	}
}