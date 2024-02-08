import { Point } from "./gen/Types.js";
import { MaybeState, State, collectMaybeState, valueOf } from "./util/State.js";
import { None, Option } from "./util/Utils.js";

export interface BoundsTester {
	testIntersection(target: Point): boolean;
}

export class Bounds implements BoundsTester {
	private constructor(
		private inner: MaybeState<BoundsTester>,
		private transform: Option<MaybeState<DOMMatrixReadOnly>>,
	) { }

	public testIntersection(target: Point): boolean {
		const transform = valueOf(this.transform);
		const position = transform === None ? target : transform.transformPoint(target);
		return valueOf(this.inner).testIntersection(position);
	}

	public transformed(matrix: MaybeState<DOMMatrixReadOnly>) {
		if (this.transform === None) return new Bounds(this.inner, matrix);
		else {
			const transform = collectMaybeState(this.transform, matrix)
				.derivedT((self, other) => self.multiply(other));
			return new Bounds(this.inner, transform);
		}
	}

	public static of(source: MaybeState<BoundsTester>) {
		return new this(source, None);
	}

	public static by(source: State<BoundsTester>) {
		const instance = new this(source.get(), None);
		return source.derived(s => {
			instance.inner = s;
			return instance;
		});
	}
}