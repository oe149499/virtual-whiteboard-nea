import { IItem, IName, IResponse } from "../GenWrapper.js";
import { AsyncIter } from "../util/AsyncIter.js";
import { Channel, makeChannel } from "../util/Channel.js";

export function createReceiver<I extends IName>(): [IterateReceiver<I>, AsyncIter<IItem<I>[]>] {
	type Item = IItem<I>[];
	const [channel, iter] = makeChannel<Item>();
	const receiver = new IterateReceiver(channel);
	return [receiver, iter];
}

export class IterateReceiver<I extends IName> {
	private futureParts = {} as { [k: number]: IItem<I>[] };
	private nextPart = 0;
	private lastPart = Number.MAX_VALUE;

	public constructor(private channel: Channel<IItem<I>[]>) { }

	public get finished() { return this.nextPart > this.lastPart; }

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