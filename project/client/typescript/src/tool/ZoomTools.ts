import { PX_PER_CM } from "../canvas/CanvasBase.js";
import { InstantaneousToolBase } from "./Tool.js";

export function ZoomTool(fn: (old: number) => number) {
	return class extends InstantaneousToolBase {
		public override execute(): void {
			this.canvas.zoom.updateBy(fn);
			console.log(this.canvas.zoom.get());
		}
	};
}

export const ZoomInTool = ZoomTool(zoom => zoom * 1.2);
export const ZoomOutTool = ZoomTool(zoom => zoom / 1.2);
export const ZoomResetTool = ZoomTool(_ => PX_PER_CM);