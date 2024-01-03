import { strftime } from "./strftime.js";
export enum LogLevel {
	Info,
	Debug,
	Warn,
	Error,
}

const LevelNames: { [level in LogLevel]: string } = {
	[LogLevel.Info]: " INFO",
	[LogLevel.Debug]: "DEBUG",
	[LogLevel.Warn]: " WARN",
	[LogLevel.Error]: "ERROR",
};

export const LogOptions = {
	minLevel: LogLevel.Info,
	timeFormat: "%Y-%m-%d@%H-%M-%S",
	logFormat: (time: Date, level: LogLevel, module: string, message: string) => {
		const timeString = strftime(LogOptions.timeFormat, time);
		return `[${timeString} | ${module}] ${LevelNames[level]}: ${message}`;
	}
};

export class Logger {
	constructor(private module: string) { }
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public log(level: LogLevel, message: string, ...objs: any[]) {
		if (level >= LogOptions.minLevel) {
			const displayString = LogOptions.logFormat(new Date(), level, this.module, message);
			switch (level) {
				case LogLevel.Info:
					console.info(displayString, ...objs);
					break;
				case LogLevel.Debug:
					console.debug(displayString, ...objs);
					break;
				case LogLevel.Warn:
					console.warn(displayString, ...objs);
					break;
				case LogLevel.Error:
					console.error(displayString, ...objs);
					break;
			}
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public info(message: string, ...objs: any[]) {
		this.log(LogLevel.Info, message, ...objs);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public debug(message: string, ...objs: any[]) {
		this.log(LogLevel.Debug, message, ...objs);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public warn(message: string, ...objs: any[]) {
		this.log(LogLevel.Warn, message, ...objs);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public error(message: string, ...objs: any[]) {
		this.log(LogLevel.Error, message, ...objs);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public throw(message: string, ...objs: any[]): never {
		this.log(LogLevel.Error, message, ...objs);
		// eslint-disable-next-line no-debugger
		debugger;
		throw undefined;
	}


	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public reject(rejector: (_?: any) => void, message: string, ...objs: any[]) {
		const error = new Error(message, { cause: objs });
		rejector(error);
		this.log(LogLevel.Error, message, ...objs);

	}
}