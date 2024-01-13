import { Logger } from "../Logger.js";
import { Tool } from "../tool/Tool.js";

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

export class ToolIcon {
	private icon: SvgIcon;
	public readonly element: HTMLElement;

	#active = false;

	public get active() {
		return this.#active;
	}

	protected set active(value) {
		this.#active = value;
		this.element.classList.set("selected", value);
	}

	public deactivate() {
		this.active = false;
	}


	public onselect: ((_: {
		tool: Tool,
		icon: ToolIcon,
	}) => boolean) | null = null;

	public ondeselect: ((_: {
		tool: Tool,
		icon: ToolIcon,
	}) => boolean) | null = null;

	constructor(iconName: string, public readonly tool: Tool) {
		this.icon = new SvgIcon(iconName);

		this.element = document.createElement("div").addClasses("tool-icon", "ui-icon");

		this.element.appendChild(this.icon.objectElement);

		this.element.onclick = () => {
			if (this.active) {
				if (this.ondeselect?.({
					tool: this.tool,
					icon: this,
				})) {
					this.active = false;
				}
			}
			else {
				if (this.onselect?.({
					tool: this.tool,
					icon: this,
				})) {
					this.active = true;
				}
			}
		};
	}
}