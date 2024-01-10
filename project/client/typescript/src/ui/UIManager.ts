import { Tool, ToolType } from "../tool/Tool.js";
import { CanvasView } from "./CanvasView.js";
import { ToolIcon } from "./Icon.js";
import { PanelController } from "./Panel.js";
import { PropertyEditor } from "./PropertiesEditor.js";

export class UIManager {
	public readonly containerElement: HTMLDivElement;
	public readonly viewPanel: PanelController;
	public readonly toolPanel: PanelController;
	public readonly propertiesPanel: PanelController;
	public readonly properties: PropertyEditor;

	public readonly canvas: CanvasView;

	public lastTool?: Tool;

	public constructor(
		svg: SVGSVGElement,
	) {
		this.containerElement = document
			.createElement("div")
			.addClasses("ui");
		this.containerElement.style.height = "100%";

		this.containerElement.appendChild(svg);
		this.canvas = new CanvasView(svg);
		svg.setAttribute("width", "100%");
		svg.setAttribute("height", "100%");

		let panelContainer = this.containerElement
			.createChild("div")
			.addClasses("bottom-container");

		panelContainer
			.createChild("div")
			.addClasses("icon-container", "panel-contents")
			.createChild("div")
			.addClasses("debug-block");

		this.viewPanel = new PanelController(panelContainer);

		panelContainer = this.containerElement
			.createChild("div")
			.addClasses("right-container");

		panelContainer
			.createChild("div")
			.addClasses("icon-container", "panel-contents");

		this.toolPanel = new PanelController(panelContainer);

		panelContainer = this.containerElement
			.createChild("div")
			.addClasses("left-container");

		const propEditorContainer = panelContainer
			.createChild("div")
			.addClasses("panel-contents");

		this.propertiesPanel = new PanelController(panelContainer);
		this.properties = new PropertyEditor(propEditorContainer);
	}

	public addToolIcon(icon: ToolIcon) {
		this.toolPanel.contents.appendChild(icon.element);
		icon.onselect = ({ tool }) => {
			this.lastTool = tool;
			switch (tool.type) {
				case ToolType.Action: {
					tool.bind(console.log.bind(null, "tool action"));
					this.properties.loadProperties(tool.properties);
				} break;
				case ToolType.Mode: {
					tool.bind();
					this.properties.loadProperties(tool.properties);
				} break;
				case ToolType.Instantaneous:
			}
			return true;
		};
	}
}