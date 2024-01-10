import { IItem, IName, IResponse } from "../GenWrapper.js";
import { Channel } from "../util/Channel.js";



export class IterateReceiver<I extends IName> {
	private futureParts = {} as { [k: number]: IItem<I>[] };
	private channel = new Channel<IItem<I>[]>();
	private nextPart = 0;
	private lastPart = Number.MAX_VALUE;

	public get finished() { return this.nextPart > this.lastPart; }
	public get iter(): AsyncIterable<IItem<I>> { return dechunk(this.channel); }
	public get chunks(): AsyncIterable<IItem<I>[]> { return this.channel; }

	public handlePayload(payload: IResponse<I>): void {
		const { part, complete, items } = payload;
		if (part == this.nextPart) {
			if (items.length) this.channel.push(items);

			while (++this.nextPart in this.futureParts) {
				const chunk = this.futureParts[this.nextPart];
				delete this.futureParts[this.nextPart];
				if (chunk.length) this.channel.push(chunk);
			}
		}

		if (complete) this.lastPart = part;

		if (this.finished) {
			this.channel.close();
		}
	}
}

async function* dechunk<T>(i: AsyncIterable<T[]>): AsyncIterable<T> {
	for await (const chunk of i) {
		for (const item of chunk) {
			yield item;
		}
	}
}