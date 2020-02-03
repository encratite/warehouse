import fs from 'fs';

let logFileHandle: fs.promises.FileHandle = null;

export async function initialize(path: string) {
	if (logFileHandle === null) {
		logFileHandle = await fs.promises.open(path, 'a');
	}
}

export async function info(message: string) {
	console.info(message);
	await write(message);
}

export async function log(message: string) {
	console.log(message);
	await write(message);
}

export async function error(message: string) {
	console.error(message);
	await write(message);
}

async function write(message: string) {
	if (logFileHandle === null) {
		throw new Error('Logging has not been initialized yet.');
	}
	const line = `${message}\n`;
	await fs.promises.write(logFileHandle, message);
}