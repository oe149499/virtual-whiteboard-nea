import { InstantaneousToolBase } from "./Tool.js";

export function ZoomTool(fn: (old: number) => number) {
	return class extends InstantaneousToolBase {
		public override execute(): void {
			this.canvas.zoom.updateBy(fn);
			console.log(this.canvas.zoom.get());
		}
	};
}