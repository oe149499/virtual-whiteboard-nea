import { Point, Transform } from "./gen/Types.js";
import { MutableState, type DeepReadonly, type State } from "./util/State.js";
import { point } from "./util/Utils.js";

export type UserTransform = {
	origin: Point,
	rotation: number,
	stretch: Point,
	skew: number,
}

export function translation(p: Point): Transform {
	return {
		origin: p,
		basisX: point(1, 0),
		basisY: point(0, 1),
	};
}

export function updateMatrix(matrix: DOMMatrix, src: DeepReadonly<Transform>) {
	matrix.a = src.basisX.x;
	matrix.b = src.basisX.y;
	matrix.c = src.basisY.x;
	matrix.d = src.basisY.y;
	matrix.e = src.origin.x;
	matrix.f = src.origin.y;
	return matrix;
}

export function fromMatrix(src: DOMMatrixReadOnly): Transform {
	return {
		origin: point(src.e, src.f),
		basisX: point(src.a, src.b),
		basisY: point(src.c, src.d),
	};
}

const tempMatrix = new DOMMatrix();

export function invertTransform(src: Transform) {
	updateMatrix(tempMatrix, src);
	tempMatrix.invertSelf();
	return fromMatrix(tempMatrix);
}

export function asDomMatrix(t: Transform): DOMMatrix;
export function asDomMatrix(t: State<Transform>): State<DOMMatrixReadOnly>;
export function asDomMatrix(t: Transform | State<Transform>): DOMMatrix | State<DOMMatrixReadOnly> {
	const matrix = new DOMMatrix();

	if ("get" in t) {
		return t.derived(t => {
			updateMatrix(matrix, t);
			return matrix as DOMMatrixReadOnly;
		});
	} else {
		updateMatrix(matrix, t);
		return matrix;
	}
}

declare module "./util/State.js" {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	interface MutableState<T> {
		updateTransform(this: MutableState<DOMMatrix>, transform: Transform): void;
	}
}

MutableState.prototype.updateTransform = function (transform) {
	this.updateBy(m => updateMatrix(m, transform));
};