import { Logger } from "../Logger.js";

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