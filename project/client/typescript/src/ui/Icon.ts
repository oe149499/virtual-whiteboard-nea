import { Logger } from "../Logger.js";
import { Tool, ToolState } from "../tool/Tool.js";
import { State, deferredStateOf } from "../util/State.js";
import { None } from "../util/Utils.js";

const logger = new Logger("ui/icon");

export class SvgIcon {
	public readonly svgElement: Promise<SVGSVGElement>;
	public readonly objectElement: HTMLObjectElement;

	public constructor(iconName: string) {
		const url = `/static/icon/${iconName}.svg`;

		this.objectElement = document.createElement("object");
		this.objectElement.setAttribute("data", url);

		this.svgElement = new Promise((resolve, reject) => {
			this.objectElement.onload = () => {
				const content = this.objectElement.contentDocument;
				if (content == null) {
					logger.reject(reject, "Failed to load file");
					return;
				}

				const svg = content.getElementsByTagName("svg");
				if (svg.length == 0) {
					logger.reject(reject, "Failed to find SVG element");
					return;
				}

				resolve(svg[0]);
			};
		});
	}
}

export type ToolIconCallback = (tool: Tool) => void;

export class ToolIcon {
	private icon: SvgIcon;
	public readonly element: HTMLElement;

	private _toolState = deferredStateOf(None as ToolState);
	public readonly active = this._toolState.derived(
		t => t !== None && t?.tool === this.tool
	);

	public onselect?: ToolIconCallback;

	public ondeselect?: ToolIconCallback;

	constructor(iconName: string, public readonly tool: Tool) {
		this.icon = new SvgIcon(iconName);

		this.element = document.createElement("div").addClasses("tool-icon", "ui-icon");

		this.element.appendChild(this.icon.objectElement);

		this.active.watch(active => this.element.classList.set("selected", active));
		this._toolState.watch(t => logger.debug("Tool state changed: %o", t));

		this.element.onclick = () => {
			logger.debug("tool icon clicked", this.active);
			if (this.active.get()) {
				this.ondeselect?.(this.tool);
			}
			else {
				this.onselect?.(this.tool);
			}
		};
	}

	public bind(toolState: State<ToolState>) {
		logger.debug("Binding to current state %o", toolState.get());
		toolState.watch(t => logger.debug("Source tool state changed: %o", t));
		this._toolState.bind(toolState);
	}
}