import { None, Option } from "./Utils.js";

const End = Symbol("IterEnd");
type End = typeof End;

const Next = Symbol("Next");
const getNext = Symbol("getNext");

export abstract class AsyncIter<T> implements AsyncIterable<T> {
	protected abstract [Next](): Promise<T | End>;

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

	public zipWith<U>(other: AsyncIter<U>): AsyncIter<[T, U]> {
		return new Zipped(this, other);
	}

	public async collect(): Promise<T[]> {
		const output = [];
		for await (const item of this) {
			output.push(item);
		}
		return output;
	}

	public static of<T>(source: AsyncIterable<T> | Iterable<T> | AsyncIterator<T>): AsyncIter<T> {
		return new Wrapped(source);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public static zip<T extends any[]>(...source: TupleIter<T>): AsyncIter<T> {
		return new Zipped<T>(...source);
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
		source: AsyncIterable<T> | Iterable<T> | AsyncIterator<T>,
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
			return this.currentChunk.pop()!;
		} else {
			this.currentChunk = await this.source[getNext]();
			return this[Next]();
		}
	}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TupleIter<T extends any[]> = { [K in keyof T]: AsyncIter<T[K]> };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class Zipped<T extends any[]> extends AsyncIter<T> {
	private source: TupleIter<T>;
	public constructor(
		...source: TupleIter<T>
	) {
		super();
		this.source = source;
	}

	protected override async [Next]() {
		const promises = this.source.map(i => i[getNext]());
		const items = await Promise.all(promises);
		if (items.indexOf(End) !== -1) return End;
		else return items as T;
	}
}