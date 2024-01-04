import { CanvasView } from "./CanvasView.js";
import { PanelController } from "./Panel.js";

export class UIManager {
	public readonly containerElement: HTMLDivElement;
	public readonly viewPanel: PanelController;

	public readonly canvas: CanvasView;

	public constructor(
		svg: SVGSVGElement,
	) {
		this.containerElement = document
			.createElement("div")
			.addClasses("ui");
		this.containerElement.style.height = "100%";

		this.containerElement.appendChild(svg);
		this.canvas = new CanvasView(svg);
		svg.style.width = "100%";
		svg.style.height = "100%";

		// eslint-disable-next-line prefer-const
		let panelContainer = this.containerElement
			.createChild("div")
			.addClasses("bottom-container");

		panelContainer
			.createChild("div")
			.addClasses("icon-container", "panel-contents")
			.createChild("div")
			.addClasses("debug-block");

		this.viewPanel = new PanelController(panelContainer);
	}
}