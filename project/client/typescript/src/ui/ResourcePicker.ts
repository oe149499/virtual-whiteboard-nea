import { Logger } from "../Logger.js";
import { API } from "../client/HttpApi.js";
import { MutableState, State, mutableStateOfNone } from "../util/State.js";
import { None, Option, getObjectID } from "../util/Utils.js";
const logger = new Logger("ui/ResourcePicker");

export function buildResourcePicker(
	target: HTMLElement,
	state: MutableState<Option<URL>>,
) {
	const urlInput = buildUrlDisplay(target);

	urlInput.onchange = () => {
		if (urlInput.value) state.set(new URL(urlInput.value));
	};

	const fileState = buildFileArea(target);
	buildUploadArea(target, fileState, state);
	state.watch(url => {
		if (url !== None) urlInput.value = url.toString();
	});
}

function buildUrlDisplay(target: HTMLElement): HTMLInputElement {
	const id = getObjectID();
	target.createChild("label")
		.setAttrs({ htmlFor: id })
		.addClasses("property-label-wide")
		.setContent("URL: ");

	const input = target.createChild("input")
		.addClasses("property-input-url")
		.setAttrs({
			id,
			type: "url",
		});
	return input;
}

function buildFileArea(target: HTMLElement): State<Option<File>> {
	const state = mutableStateOfNone<File>();
	const input = target.createChild("input")
		.setAttrs({ type: "file" })
		.addClasses("property-input-file");

	input.onchange = () => {
		if (!input.files) return;
		if (input.files.length === 0) {
			state.set(None);
		} else {
			state.set(input.files[0]);
		}
		logger.debug("File selected", input.files);
	};
	return state;
}

function buildUploadArea(target: HTMLElement, fileState: State<Option<File>>, urlState: MutableState<Option<URL>>) {
	const btn = target.createChild("button")
		.addClasses("property-file-upload-button")
		.setContent("Upload");

	btn.classList.setBy(
		"file-present",
		fileState.derived(o => o !== None)
	);

	btn.onclick = async () => {
		const file = fileState.get();
		if (file === None) return;
		logger.debug("Uploading file");
		const url = await API.uploadFile(file);
		urlState.set(url);
		logger.debug("Uploaded file", url);
	};
}