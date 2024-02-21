import { Point, Transform } from "./gen/Types.js";
import { MutableState, type DeepReadonly, type State } from "./util/State.js";
import { deg2rad, point, rad2deg } from "./util/Utils.js";

// import { DeepReadonly, MutableTransformer, type State } from "./util/State.js";
export type UserTransform = {
	origin: Point,
	rotation: number,
	stretch: Point,
	skew: number,
}

export function unitTransform(): Transform {
	return {
		origin: point(),
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

// export class UserTransformConverter extends MutableTransformer<Transform, UserTransform> {
// 	public override forwards(src: DeepReadonly<Transform>): UserTransform {
// 		const { origin, basisX, basisY } = src;

// 		const rotation = Math.atan2(basisX.y, basisX.x);

// 		const stretchX = Math.sqrt(
// 			basisX.x * basisX.x + basisX.y * basisX.y,
// 		);

// 		const ct = Math.cos(rotation);
// 		const st = Math.sin(rotation);

// 		const oyx = +ct * basisY.x + st * basisY.y;
// 		const oyy = -st * basisY.x + ct * basisY.y;

// 		const skew = oyx / stretchX;
// 		const stretchY = oyy;

// 		return {
// 			origin: point(origin.x, origin.y),
// 			rotation: rad2deg(rotation),
// 			stretch: point(stretchX, stretchY),
// 			skew,
// 		};
// 	}

// 	public override backwards(src: DeepReadonly<UserTransform>): Transform {
// 		const { skew, stretch, origin } = src;
// 		const rotation = deg2rad(src.rotation);

// 		const bx = point(stretch.x, 0);
// 		const by = point(skew * stretch.x, stretch.y);

// 		const ct = Math.cos(rotation);
// 		const st = Math.sin(rotation);

// 		const rx = point(
// 			ct * bx.x - st * bx.y,
// 			st * bx.x + ct * bx.y,
// 		);

// 		const ry = point(
// 			ct * by.x - st * by.y,
// 			st * by.x + ct * by.y,
// 		);

// 		return { origin: point(origin.x, origin.y), basisX: rx, basisY: ry };
// 	}
// }

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
	interface MutableState<T> {
		updateTransform(this: MutableState<DOMMatrix>, transform: Transform): void;
	}
}

MutableState.prototype.updateTransform = function (transform) {
	this.updateBy(m => updateMatrix(m, transform));
};