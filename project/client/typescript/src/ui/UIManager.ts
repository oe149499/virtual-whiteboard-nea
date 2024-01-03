import { PanelController } from "./Panel.js";

export class UIManager {
	public readonly containerElement: HTMLDivElement;
	public readonly viewPanel: PanelController;

	public constructor() {
		this.containerElement = document.createElement("div");
		this.containerElement.classList.add("ui");
		this.containerElement.style.height = "100%";

		let panelContainer = document.createElement("div");
		panelContainer.classList.add("bottom-container");
		this.viewPanel = new PanelController(panelContainer);
	}
}