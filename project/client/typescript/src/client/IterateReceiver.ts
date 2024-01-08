import { IItem, IName, IResponse } from "../GenWrapper.js";
import { Channel } from "../util/Channel.js";

export class IterateReceiver<I extends IName> {
	private futureParts = {} as { [k: number]: IItem<I>[] };
	private channel = new Channel<IItem<I>>();
	private nextPart = 0;
	private lastPart = Number.MAX_VALUE;

	public get finished() { return this.nextPart > this.lastPart; }
	public get iter(): AsyncIterable<IItem<I>> { return this.channel; }

	public handlePayload(payload: IResponse<I>): void {
		const { part, complete, items } = payload;
		if (part == this.nextPart) {
			for (const item of items) {
				this.channel.push(item);
			}

			while (++this.nextPart in this.futureParts) {
				for (const item of this.futureParts[this.nextPart]) {
					this.channel.push(item);
				}
			}
		}

		if (complete) this.lastPart = part;
	}
}