import { MethodNames, Methods } from "./gen/Methods.js";

export type MName = keyof Methods;

export type MArgs<M extends MName> = Methods[M][0];
export type MRet<M extends MName> = Methods[M][1];
type MCall<M extends MName> = (args: MArgs<M>) => Promise<MRet<M>>;

export type MPayload<M extends MName> = {
	protocol: "Method",
	id: number,
	name: M,
} & MArgs<M>;

export function createMethodPayload<M extends MName>(
	name: M,
	args: MArgs<M>,
): MPayload<M> {
	return {
		protocol: "Method",
		id: null as unknown as number,
		name: name,
		...args,
	};
}

export type MethodDispatcher = {
	[M in MName]: MCall<M>;
}

type MethodHandler = <M extends MName>(args: MArgs<M>) => Promise<MRet<M>>;

export function createMethodReciever(handler: MethodHandler): MethodDispatcher {
	// This should work but fails type checking
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const result = {} as any;
	for (const name of MethodNames) {
		result[name] = function(args: MArgs<typeof name>) {
			return handler(args);
		};
	}
	return result as MethodDispatcher;
}