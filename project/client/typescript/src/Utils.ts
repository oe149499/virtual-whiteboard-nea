import { Result } from "./gen/Types";

export function ok<T, TErr>(res: Result<T, TErr>): res is {status: "Ok"} & T {
	if (res.status == "Ok") {
		return true;
	} else if (res.status == "Err") {
		return false;
	} else {
		todo();
		return "unreachable" as unknown as boolean;
	}
}

function removeStatus<T>(res: T & {status: string}): T {
	const {status:_, ...rest} = res;
	// @ts-expect-error Removing {status: ...} from T & {status: ...} is probably the same as T
	return rest;
}

export function unwrap<T, TErr>(res: Result<T, TErr>, f?: (_: TErr) => T | never): T {
	if (ok(res)) {
		return removeStatus(res);
	} else {
		const err = removeStatus(res);
		if (f != undefined) {
			return f(err);
		} else {
			throw new Error(`unwrap() called on an error value: ${err}`);
		}
	}
}

export function todo() {
	throw new Error("Not yet implemented");
}