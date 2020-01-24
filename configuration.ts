import fs from 'fs';
import transmission from 'transmission';

import * as obfuscation from './obfuscation.js';

export interface Configuration {
	listenPort: number;
	listenHostname: string;
	externalHostname: string;
	mongoDbUri: string;
	sites: Site[];
	transmission: transmission.TransmissionOptions;
}

export interface Site {
	name: string;
	username: string;
	password: string;
}

const configurationPath = 'configuration.json';

export async function read(): Promise<Configuration> {
	const configurationJson = await new Promise<string>((resolve, reject) => {
		fs.readFile(configurationPath, 'utf8', (error, contents) => {
			if (error == null) {
				resolve(contents);
			}
			else {
				reject(error);
			}
		});
	});
	const configuration = <Configuration>JSON.parse(configurationJson);
	return configuration;
}

export async function write(configuration: Configuration) {
	const configurationJson = JSON.stringify(configuration, null, 4);
	await new Promise((resolve, reject) => {
		fs.writeFile(configurationPath, configurationJson, (error) => {
			if (error == null) {
				resolve();
			}
			else {
				reject(error);
			}
		});
	});
}

export function obfuscate(configuration: Configuration) {
	if (configuration.mongoDbUri != null) {
		const pattern = /^mongodb:\/\/.+?:.+?@/;
		const match = pattern.test(configuration.mongoDbUri);
		if (match === true) {
			configuration.mongoDbUri = obfuscation.obfuscate(configuration.mongoDbUri);
		}
	}
	if (configuration.sites != null) {
		configuration.sites.forEach(site => {
			site.username = obfuscation.obfuscate(site.username);
			site.password = obfuscation.obfuscate(site.password);
		});
	}
	const transmission = configuration.transmission;
	if (transmission != null) {
		transmission.username = obfuscation.obfuscate(transmission.username);
		transmission.password = obfuscation.obfuscate(transmission.password);
	}
}

export function deobfuscate(configuration: Configuration) {
	configuration.mongoDbUri = obfuscation.deobfuscate(configuration.mongoDbUri);
	if (configuration.sites != null) {
		configuration.sites.forEach(site => {
			site.username = obfuscation.deobfuscate(site.username);
			site.password = obfuscation.deobfuscate(site.password);
		});
	}
}