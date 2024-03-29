import { None, Option } from "./Utils.js";

const End = Symbol("IterEnd");
type End = typeof End;


/// Typescript doesn't allow accessing a protected base method of
/// another instance from a derived class, so these symbols are used 
/// to effectively restrict the scope of the methods to this file

const Next = Symbol("Next");
const getNext = Symbol("getNext");

export type AsyncIterInit<T> = AsyncIterable<T> | AsyncIterator<T> | Iterable<T> | AsyncIter<T>;

/** 
 * A wrapper class around async iterators that provides methods for processing them
 * This is impossible with the builtin system since it's just an interface
 */
export abstract class AsyncIter<T> implements AsyncIterable<T> {
	/** Get the next item from whatever the underlying source is */
	protected abstract [Next](): Promise<T | End>;

	/** Extract the next item taking into account the peeked item */
	protected async [getNext](): Promise<T | End> {
		if (this.isEnd) return End;
		if (this.peekCache !== None) {
			const val = this.peekCache;
			this.peekCache = None;
			return val;
		} else {
			const val = await this[Next]();
			if (val === End) this.isEnd = true;
			return val;
		}
	}

	private isEnd = false;

	/** Implements the JS async iterator protocol for compatibility with for-await loops */
	private readonly iterator: AsyncIterator<T> = {
		next: async () => {
			const n = await this[getNext]();
			if (n === End) return {
				done: true,
				value: End,
			}; else return {
				done: false,
				value: n,
			};
		},
	};

	private peekCache: Option<T | End> = None;

	public [Symbol.asyncIterator]() {
		return this.iterator;
	}

	public async next(): Promise<Option<T>> {
		const val = await this[getNext]();
		if (val === End) return None;
		else return val;
	}

	public async peek(): Promise<Option<T>> {
		if (this.peekCache === None) this.peekCache = await this[getNext]();
		if (this.peekCache === End) return None;
		else return this.peekCache;
	}

	public map<U>(fn: (_: T) => U): AsyncIter<U> {
		return new Mappped(this, fn);
	}

	public dechunk<T>(this: AsyncIter<T[]>): AsyncIter<T> {
		return new Dechunked(this);
	}

	public async collect(): Promise<T[]> {
		const output = [];
		for await (const item of this) {
			output.push(item);
		}
		return output;
	}

	public async last(): Promise<Option<T>> {
		let current: Option<T> = None;
		for await (current of this);
		return current;
	}

	public static of<T>(source: AsyncIterInit<T>): AsyncIter<T> {
		if (source instanceof this) return source;
		return new Wrapped(source);
	}
}

class Wrapped<T> extends AsyncIter<T> {
	private inner: AsyncIterator<T>;

	protected override async [Next](): Promise<T | typeof End> {
		const { done, value } = await this.inner.next();
		if (done) return End;
		else return value;
	}

	public constructor(
		source: AsyncIterInit<T>,
	) {
		super();
		if (Symbol.asyncIterator in source) {
			this.inner = source[Symbol.asyncIterator]();
		} else if (Symbol.iterator in source) {
			const iter = source[Symbol.iterator]();
			this.inner = {
				next() { return Promise.resolve(iter.next()); },
			};
		} else {
			this.inner = source;
		}
	}
}

class Mappped<T, U> extends AsyncIter<U> {
	public constructor(
		private source: AsyncIter<T>,
		private fn: (_: T) => U,
	) {
		super();
	}

	protected override[Next]() {
		return this.source[getNext]().then(sourceVal => {
			if (sourceVal === End) return End;
			else return this.fn(sourceVal);
		});
	}
}

class Dechunked<T> extends AsyncIter<T> {
	public constructor(private source: AsyncIter<T[]>) { super(); }

	private currentChunk: T[] | End = [];

	protected override async [Next](): Promise<T | End> {
		if (this.currentChunk === End) return End;
		if (this.currentChunk.length > 0) {
			return this.currentChunk.shift()!;
		} else {
			this.currentChunk = await this.source[getNext]();
			return this[Next]();
		}
	}
}