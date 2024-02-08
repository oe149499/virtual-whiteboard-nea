import { Point, SplineNode } from "../gen/Types.js";

export class PathHelper {
	private nodes: SplineNode[] = [];
	private currentValue: string;

	constructor(
		private elem: SVGPathElement,
		startPos: Point,
	) {
		this.currentValue = `M ${startPos.x} ${startPos.y} c 0 0 0 0 0 0 S`;
		elem.setAttribute("d", this.currentValue);
	}

	public addNode(s: SplineNode) {
		this.addNodes([s]);
	}

	public addNodes(ns: SplineNode[]) {
		const strs = ns.map(
			n => `${n.position.x - n.velocity.x} ${n.position.y - n.velocity.y} ${n.position.x} ${n.position.y}`,
		);
		this.currentValue = [this.currentValue, ...strs].join(" ");
		this.elem.setAttribute("d", this.currentValue);
		this.nodes = this.nodes.concat(ns);
	}
}