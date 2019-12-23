import fs from 'fs';

import * as obfuscation from './obfuscation.js';

export interface Configuration {
	listenPort: number;
	listenHostname: string;
	mongoDbUri: string;
	mongoDbUriSecure: string;
}

const configurationPath = 'configuration.json';

export async function read(): Promise<Configuration> {
	const configurationJson = await new Promise<string>((resolve, reject) => {
		fs.readFile(configurationPath, 'utf8', (error, contents) => {
			if (error != null) {
				throw error;
			}
			resolve(contents);
		});
	});
	const configuration = <Configuration>JSON.parse(configurationJson);
	return configuration;
}

export async function write(configuration: Configuration) {
	const configurationJson = JSON.stringify(configuration, null, 4);
	await new Promise((resolve, reject) => {
		fs.writeFile(configurationPath, configurationJson, (error) => {
			if (error != null) {
				throw error;
			}
			resolve();
		});
	});
}

export function deobfuscate(configuration: Configuration) {
	if (configuration.mongoDbUriSecure != null) {
		configuration.mongoDbUri = obfuscation.deobfuscate(configuration.mongoDbUriSecure);
	}
}