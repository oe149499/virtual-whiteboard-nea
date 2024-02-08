import { Point, Transform } from "./gen/Types.js";
import { DeepReadonly, MutableTransformer } from "./util/State.js";
import { deg2rad, point, rad2deg } from "./util/Utils.js";

export type UserTransform = {
	origin: Point,
	rotation: number,
	stretch: Point,
	skew: number,
}

export class TransformMatrixConverter extends MutableTransformer<Transform, DOMMatrix> {
	private matrix = new DOMMatrix();

	public override forwards(src: DeepReadonly<Transform>): DOMMatrix {
		this.matrix.a = src.basisX.x;
		this.matrix.b = src.basisX.y;
		this.matrix.c = src.basisY.x;
		this.matrix.d = src.basisY.y;
		this.matrix.e = src.origin.x;
		this.matrix.f = src.origin.y;
		return this.matrix;
	}

	public override backwards(src: DOMMatrixReadOnly): Transform {
		return {
			origin: point(src.e, src.f),
			basisX: point(src.a, src.b),
			basisY: point(src.c, src.d),
		};
	}
}

export class UserTransformConverter extends MutableTransformer<Transform, UserTransform> {
	public override forwards(src: DeepReadonly<Transform>): UserTransform {
		const { origin, basisX, basisY } = src;

		const rotation = Math.atan2(basisX.y, basisX.x);

		const stretchX = Math.sqrt(
			basisX.x * basisX.x + basisX.y * basisX.y,
		);

		const ct = Math.cos(rotation);
		const st = Math.sin(rotation);

		const oyx = +ct * basisY.x + st * basisY.y;
		const oyy = -st * basisY.x + ct * basisY.y;

		const skew = oyx / stretchX;
		const stretchY = oyy;

		return {
			origin: point(origin.x, origin.y),
			rotation: rad2deg(rotation),
			stretch: point(stretchX, stretchY),
			skew,
		};
	}

	public override backwards(src: DeepReadonly<UserTransform>): Transform {
		const { skew, stretch, origin } = src;
		const rotation = deg2rad(src.rotation);

		const bx = point(stretch.x, 0);
		const by = point(skew * stretch.x, stretch.y);

		const ct = Math.cos(rotation);
		const st = Math.sin(rotation);

		const rx = point(
			ct * bx.x - st * bx.y,
			st * bx.x + ct * bx.y,
		);

		const ry = point(
			ct * by.x - st * by.y,
			st * by.x + ct * by.y,
		);

		return { origin: point(origin.x, origin.y), basisX: rx, basisY: ry };
	}
}