type ExportList = {
	[prefix: string]: string[]
}

function dumpModule(path: string) {
	// @ts-expect-error Only used for testing
	return import(path).then(module => {
		for (const prop of Object.getOwnPropertyNames(module)) {
			// @ts-expect-error this is just wrong
			window[prop] = module[prop];
		}
	});
}

function* getPaths(list: ExportList): IterableIterator<string> {
	for (const prefix in list) {
		for (const name of list[prefix]) {
			yield `/script/${prefix}${name}.js`;
		}
	}
}

export default function dumpList(list: ExportList) {
	const promises = Array.from(getPaths(list), dumpModule);
	return Promise.all(promises).then(() => { });
}
