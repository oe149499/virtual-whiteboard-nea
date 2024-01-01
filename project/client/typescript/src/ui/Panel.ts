import { Logger } from "../Logger.js";

const logger = new Logger("panel");

export class PanelController {
	private visibility: VisibilityButton;

	public constructor(
		private containerElement: HTMLElement,
	) {
		this.visibility = new VisibilityButton("panel-icon");
		this.containerElement.appendChild(
			this.visibility.element
		);
	}

}

class VisibilityButton {
	private container: HTMLDivElement;
	private object: HTMLObjectElement;
	private svg: Promise<SVGSVGElement>;

	private open = false;

	public get element(): HTMLElement {
		return this.container;
	}

	public constructor(iconName: string) {
		const url = `/static/icon/${iconName}.svg`;

		this.container = document.createElement("div");
		this.container.setAttribute("class", "ui-icon");

		this.object = document.createElement("object");
		this.object.setAttribute("data", url);
		this.container.appendChild(this.object);

		this.svg = new Promise((resolve, reject) => {
			this.object.onload = () => {
				const content = this.object.contentDocument;
				if (content == null) {
					return reject();
				}
				const svg = content.querySelector("svg");
				if (svg == null) {
					return reject();
				}
				resolve(svg);
			};
		});

		this.container.onclick = async () => {
			logger.debug("click");
			const classes = (await this.svg).classList;
			if (this.open) {
				classes.remove("open");
				this.open = false;
				this.object.offsetWidth;
				classes.add("closed");
			} else {
				classes.remove("closed");

				this.open = true;
				classes.add("open");
			}
		};
	}
}