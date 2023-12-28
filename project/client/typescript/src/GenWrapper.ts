import { MethodNames, Methods } from "./gen/Methods.js";
import { NotifyCs } from "./gen/NotifyC.js";
import type { Color, Item, Stroke, Transform } from "./gen/Types.js";

type Id<T> = { [K in keyof T]: T[K] };

export type ItemType = Item["type"];
export type SpecificItem<T extends ItemType> = Id<Extract<Item, { type: T }>>

export interface HasTransform { transform: Transform }
export interface HasStroke { stroke: Stroke }
export interface HasFill { fill: Color }

export type MName = keyof Methods;

export type MArgs<M extends MName = MName> = Methods[M][0];
export type MRet<M extends MName = MName> = Methods[M][1];
type MCall<M extends MName = MName> = (args: MArgs<M>) => Promise<MRet<M>>;

export type MPayload<M extends MName = MName> = {
	protocol: "Method",
	id: number,
	name: M,
} & MArgs<M>;

export type MResponse<M extends MName = MName> = {
	protocol: "Response",
	id: number,
	value: MRet<M>,
}

export function createMethodPayload<M extends MName>(
	name: M,
	id: number,
	args: MArgs<M>,
): MPayload<M> {
	return {
		protocol: "Method",
		id: id,
		name: name,
		...args,
	};
}

export type MethodDispatcher = {
	[M in MName]: MCall<M>;
}

export type MethodHandler = <M extends MName>(name: M, args: MArgs<M>) => Promise<MRet<M>>;

export function createMethodReciever(handler: MethodHandler): MethodDispatcher {
	// This should work but fails type checking
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const result = {} as any;
	for (const name of MethodNames) {
		result[name] = function (args: MArgs<typeof name>) {
			return handler(name, args);
		};
	}
	return result as MethodDispatcher;
}

export type NCName = keyof NotifyCs;

export type NCArgs<N extends NCName = NCName> = NotifyCs[N];

export type NCPayload<N extends NCName> = {
	protocol: "Notify-C",
	name: N,
} & NCArgs<N>;


export type MethodCall = MPayload<MName>;

export type MethodResponse = MResponse<MName>;

export type NotifyC = NCPayload<NCName>;

export type MsgSend = MethodCall;

export type MsgRecv = MethodResponse | NotifyC;