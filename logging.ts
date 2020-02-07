import fs from 'fs';

let logFileHandle: fs.promises.FileHandle = null;

export async function initialize(path: string) {
	if (logFileHandle === null) {
		logFileHandle = await fs.promises.open(path, 'a');
	}
}

export async function info(message: string) {
	await write(message, console.info);
}

export async function log(message: string) {
	await write(message, console.log);
}

export async function warn(message: string) {
	await write(message, console.warn);
}

export async function error(message: string) {
	await write(message, console.error);
}

async function write(message: string, consoleHandler: (message: string) => void) {
	const timestamp = getTimestamp();
	const formattedMessage = `${timestamp} ${message}`;
	consoleHandler(formattedMessage);
	if (logFileHandle === null) {
		throw new Error('Logging has not been initialized yet.');
	}
	const logMessage = `${formattedMessage}\n`;
	await fs.promises.write(logFileHandle, logMessage);
}

function getTimestamp() {
	// Questionable method to generate "yyyy-MM-dd HH:mm:ss"-style timestamps.
	const now = new Date();
	const dateOptions = {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	};
	const datePortion = now.toLocaleDateString('ja', dateOptions);
	const datePortionFormatted = datePortion.replace(/\//g, '-');
	const timeOptions = {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	};
	const timePortion = now.toLocaleDateString('en-GB', timeOptions);
	const timePortionFormatted = timePortion.substring(12);
	const timestamp = `${datePortionFormatted} ${timePortionFormatted}`;
	return timestamp;
}