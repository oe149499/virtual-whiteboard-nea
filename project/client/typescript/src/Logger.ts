export enum LogLevel {
	Trace,
	Info,
	Debug,
	Warn,
	Error,
}

const LevelNames: { [level in LogLevel]: string } = {
	[LogLevel.Trace]: "TRACE",
	[LogLevel.Info]: " INFO",
	[LogLevel.Debug]: "DEBUG",
	[LogLevel.Warn]: " WARN",
	[LogLevel.Error]: "ERROR",
};

const dateFormat = new Intl.DateTimeFormat(undefined, {
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
});

function logFormat(time: Date, level: LogLevel, module: string, message: string) {
	const partsMap = {} as Record<Intl.DateTimeFormatPartTypes, string>;
	dateFormat.formatToParts(time).forEach(({ type, value }) => partsMap[type] = value);
	const { year, month, day, hour, minute, second } = partsMap;
	return `[${year}-${month}-${day}@${hour}-${minute}-${second} | ${module}] ${LevelNames[level]}: ${message}`;
}

export const LogOptions = {
	minLevel: LogLevel.Info,
	timeFormat: "%Y-%m-%d@%H-%M-%S",
	logFormat,
};

export class Logger {
	constructor(private module: string) { }

	public log(level: LogLevel, message: string, ...objs: unknown[]) {
		if (level >= LogOptions.minLevel) {
			const displayString = LogOptions.logFormat(new Date(), level, this.module, message);
			switch (level) {
				case LogLevel.Trace:
					console.info(displayString, ...objs);
					break;
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

	public trace(message: string, ...objs: unknown[]) {
		this.log(LogLevel.Trace, message, ...objs);
	}

	public info(message: string, ...objs: unknown[]) {
		this.log(LogLevel.Info, message, ...objs);
	}

	public debug(message: string, ...objs: unknown[]) {
		this.log(LogLevel.Debug, message, ...objs);
	}

	public warn(message: string, ...objs: unknown[]) {
		this.log(LogLevel.Warn, message, ...objs);
	}

	public error(message: string, ...objs: unknown[]) {
		this.log(LogLevel.Error, message, ...objs);
	}

	public throw(message: string, ...objs: unknown[]): never {
		this.log(LogLevel.Error, message, ...objs);
		// eslint-disable-next-line no-debugger
		debugger;
		throw undefined;
	}

	public reject(rejector: (_?: unknown) => void, message: string, ...objs: unknown[]) {
		const error = new Error(message, { cause: objs });
		rejector(error);
		this.log(LogLevel.Error, message, ...objs);
	}
}