import path from 'path';
import process from 'process';
import minimist from 'minimist';

import { Warehouse } from './warehouse.js';
import * as configurationFile from './configuration.js';
import * as passwordGenerator from './password.js';
import * as obfuscation from './obfuscation.js';

function main() {
	const processArguments = process.argv.slice(2);
	const parsedArguments = minimist(processArguments);

	const getArgument = (short: string, long: string) => {
		if (parsedArguments.hasOwnProperty(short)) {
			return parsedArguments[short];
		}
		else if (parsedArguments.hasOwnProperty(long)) {
			return parsedArguments[long];
		}
		else {
			return null;
		}
	};

	const serviceArgument = getArgument('s', 'service');
	const obfuscateArgument = getArgument('o', 'obfuscate');
	const createArgument = getArgument('c', 'create');
	const adminArgument = getArgument('a', 'admin');
	const deleteArgument = getArgument('d', 'delete');
	const helpArgument = getArgument('h', 'help');

	if (serviceArgument === true) {
		startService();
	}
	if (obfuscateArgument === true) {
		obfuscateConfiguration();
	}
	else if (createArgument != null) {
		const isAdmin = adminArgument === true;
		createUser(createArgument, isAdmin);
	}
	else if (deleteArgument != null) {
		deleteUser(deleteArgument);
	}
	else if (processArguments.length === 0 || helpArgument != null) {
		printHelp();
	}
	else {
		console.log('Invalid argument. Run with -h for help.');
	}
}

async function startService() {
	try {
		const warehouse = await getWarehouse();
		await warehouse.start();
	}
	catch (error) {
		onError(error);
	}
}

async function obfuscateConfiguration() {
	const configuration = await configurationFile.read();
	let writeConfiguration = false;
	if (configuration.mongoDbUri != null && configuration.mongoDbUriSecure == null) {
		const pattern = /^mongodb:\/\/.+?:.+?@/;
		const match = pattern.exec(configuration.mongoDbUri);
		if (match != null) {
			const obfuscatedMongoDbUri = obfuscation.obfuscate(configuration.mongoDbUri);
			configuration.mongoDbUri = null;
			configuration.mongoDbUriSecure = obfuscatedMongoDbUri;
			writeConfiguration = true;
		}
	}
	if (writeConfiguration === true) {
		await configurationFile.write(configuration);
	}
}

async function createUser(username: string, isAdmin: boolean) {
	try {
		const warehouse = await getWarehouse();
		const password = passwordGenerator.generatePassword();
		await warehouse.createUser(username, password, isAdmin);
		console.log(`Created user "${username}" with password "${password}".`);
	}
	catch (error) {
		onError(error);
	}
}

async function deleteUser(username: string) {
	try {
		const warehouse = await getWarehouse();
		await warehouse.deleteUser(username);
		console.log(`Deleted user "${username}".`);
	}
	catch (error) {
		onError(error);
	}
}

function printHelp() {
	const script = path.basename(process.argv[1]);
	const helpLines = [
		'Usage:',
		`  ${script} [OPTION]`,
		'',
		'Run warehouse service or manage its users.',
		'',
		'Options:',
		'  -s, --service        Start warehouse service.',
		'  -o, --obfuscate      Obfuscates sensitive content in the configuration file.',
		'  -c, --create=user    Create a new user with a random password.',
		'  -a, --admin          When creating a new user, make that user an admin.',
		'                       Only works in combination with -c.',
		'  -d, --delete=user    Delete a user.',
		'  -h, --help           Print help menu.'
	];
	const helpText = helpLines.join('\n');
	console.log(helpText);
}

async function getWarehouse(): Promise<Warehouse> {
	const configuration = await configurationFile.read();
	const warehouse = new Warehouse(configuration);
	return warehouse;
}

function onError(error: any) {
	console.error(error.message);
	process.exitCode = 1;
}

main();