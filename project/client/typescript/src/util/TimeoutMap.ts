export class TimeoutMap<TKey> {
	private map = new Map<TKey, number>();

	constructor(private delay: number, private callback: (_: TKey) => void) { }

	public add(key: TKey) {
		const handle = setTimeout(this.callback, this.delay, key);
		this.map.set(key, handle);
	}

	public push(key: TKey) {
		const handle = this.map.get(key);
		if (handle !== undefined) clearTimeout(handle);
		const newHandle = setTimeout(this.callback, this.delay, key);
		this.map.set(key, newHandle);
	}

	public clear(key: TKey) {
		const handle = this.map.get(key);
		clearTimeout(handle);
		this.map.delete(key);
	}
}