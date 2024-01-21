import { Transform } from "../gen/Types.js";
import { None, Option, point } from "../util/Utils.js";
import { CanvasContext, TransformHelper } from "./CanvasBase.js";

export class SelectionBox {
	container: SVGGElement;
	outerBorder: SVGRectElement;
	borderTransform: TransformHelper;

	constructor(private ctx: CanvasContext) {
		this.container = ctx.createRootElement("g");
		this.outerBorder = this.container.createChild("rect")
			.addClasses("selection")
			.setAttrs({
				width: 10,
				height: 10,
			});
		const startTransform = {
			origin: point(),
			rotation: 0,
			stretchX: 1,
			stretchY: 1,
		};

		this.borderTransform = new TransformHelper(ctx, this.outerBorder.transform.baseVal, startTransform);

		this.bindDrag(startTransform);
	}

	private bindDrag(startBox: Transform) {
		let pointerId: Option<number> = None;
		let initialX = startBox.origin.x;
		let initialY = startBox.origin.y;

		let dx = -1;
		let dy = -1;
		this.container.onpointerdown = e => {
			if (pointerId !== None) return;

			pointerId = e.pointerId;

			dx = 0;
			dy = 0;
		};

		this.container.parentElement?.addEventListener("pointermove", e => {
			if (e.pointerId !== pointerId) return;

			dx += e.movementX;
			dy += e.movementY;

			this.borderTransform.updateOrigin({
				x: initialX + dx,
				y: initialY + dy,
			});
		});

		this.container.onpointerup = e => {
			if (e.pointerId != pointerId) return;

			initialX += dx;
			initialY += dy;
		};
	}
}