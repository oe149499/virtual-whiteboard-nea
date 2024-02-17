type ROAction<T> = (_: T) => void;

interface WatchHandle {
	end(): void;
	poll(): this;
}

const watchWeak = Symbol();

class State {
	private callback?: WeakRef<(_: Point) => void>;

	public constructor(public value: Point) { }
	public get() {
		return this.value;
	}

	public update(value: Point) {
		this.value = value;
		this.callback?.deref()?.(value);
	}

	private static WatchOnMap = new WeakMap<object, unknown[]>();

	public watchOn(o: object, f: ROAction<Point>) {
		const handle = this[watchWeak](f);
		const entry = State.WatchOnMap.get(o);
		if (entry === undefined) State.WatchOnMap.set(o, [handle]);
		else entry.push(handle);
	}

	public [watchWeak](f: (_: Point) => void) {
		this.callback = new WeakRef(f);
		return [this, f];
	}

	public derived(f: (_: Point) => Point): State {
		return new DerivedState(this, f);
	}
}
class DerivedState extends State {
	#_c: unknown;
	public constructor(
		private source: State,
		private map: (_: Point) => Point,
	) {
		super(map(source.get()));
		const callback = (v: Point) => {
			console.log("updating inner");
			this.update(map(v));
			console.log(this.#_c);
		};
		source[watchWeak](callback);
		this.#_c = callback;
	}
}

type Point = { x: number, y: number };

function createPoint(svg: SVGSVGElement, x: number, y: number) {
	const point = svg.createSVGPoint();
	point.x = x;
	point.y = y;
	return point;
}

function createPointBy(svg: SVGSVGElement, p: State) {
	const point = svg.createSVGPoint();
	p.watchOn(point, ({ x, y }) => {
		console.log("Updating point");
		console.log(point.x);
		point.x = x;
		point.y = y;
		console.log("Updated point");
	});
	return point;
}


export function crashTest(el: SVGPolygonElement) {
	const svg = el.ownerSVGElement!;

	const pointState = new State({ x: 0, y: 0 });

	const derived = pointState.derived(p => ({ x: p.x * 300, y: p.y * 150 }));

	const list = el.points;
	list.appendItem(createPoint(svg, 10, 10));
	list.appendItem(createPoint(svg, 110, 10));
	list.appendItem(createPointBy(svg, derived));

	return {
		svg, el,
		shuffle() {
			console.log("Updating");
			pointState.update({
				x: Math.random(),
				y: Math.random(),
			});
		},
	};
}