import path from 'path';
import process from 'process';
import minimist from 'minimist';

import { Warehouse } from './warehouse.js';
import * as configurationFile from './configuration.js';
import * as passwordGenerator from './password.js';

function main() {
	const processArguments = process.argv.slice(2);
	const parsedArguments = minimist(processArguments);

	const getArgument = (short: string, long: string) => {
		let output: any = null;
		if (parsedArguments.hasOwnProperty(short)) {
			output = parsedArguments[short];
			if (typeof output === 'string') {
				// Workaround for minimist adding a space when using short notation.
				output = output.trim();
			}
		}
		else if (parsedArguments.hasOwnProperty(long)) {
			output = parsedArguments[long];
		}
		return output;
	};

	const serviceArgument = getArgument('s', 'service');
	const obfuscateArgument = getArgument('o', 'obfuscate');
	const createArgument: string = getArgument('c', 'create');
	const adminArgument = getArgument('a', 'admin');
	const deleteArgument: string = getArgument('d', 'delete');
	const configArgument: string = getArgument('C', 'config') || 'configuration.json';
	const helpArgument = getArgument('h', 'help');

	if (serviceArgument === true) {
		startService(configArgument);
	}
	else if (obfuscateArgument === true) {
		obfuscateConfiguration(configArgument);
	}
	else if (createArgument != null) {
		const isAdmin = adminArgument === true;
		createUser(createArgument, isAdmin, configArgument);
	}
	else if (deleteArgument != null) {
		deleteUser(deleteArgument, configArgument);
	}
	else if (processArguments.length === 0 || helpArgument != null) {
		printHelp();
	}
	else {
		console.log('Invalid argument. Run with -h for help.');
	}
}

async function startService(configurationPath: string) {
	try {
		await obfuscateConfiguration(configurationPath);
		const warehouse = await getWarehouse(configurationPath);
		await warehouse.start();
	}
	catch (error) {
		onError(error);
	}
}

async function obfuscateConfiguration(configurationPath: string) {
	const configuration = await configurationFile.read(configurationPath);
	configurationFile.obfuscate(configuration);
	await configurationFile.write(configuration, configurationPath);
}

async function createUser(username: string, isAdmin: boolean, configurationPath: string) {
	withWarehouse(configurationPath, async warehouse => {
		await warehouse.initializeDatabase();
		const password = passwordGenerator.generatePassword();
		await warehouse.createUser(username, password, isAdmin);
		console.log(`Created user "${username}" with password "${password}".`);
	});
}

async function deleteUser(username: string, configurationPath: string) {
	withWarehouse(configurationPath, async warehouse => {
		await warehouse.initializeDatabase();
		const success = await warehouse.deleteUser(username);
		if (success === true) {
			console.log(`Deleted user "${username}".`);
		}
		else {
			console.log(`Unable to find user "${username}".`);
		}
	});
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
		'  -C, --config=path    Set the path to the service configuration file.',
		'                       The path defaults to "configuration.json".',
		'  -h, --help           Print help menu.'
	];
	const helpText = helpLines.join('\n');
	console.log(helpText);
}

async function getWarehouse(configurationPath: string): Promise<Warehouse> {
	const configuration = await configurationFile.read(configurationPath);
	const warehouse = new Warehouse(configuration);
	return warehouse;
}

async function withWarehouse(configurationPath: string, handler: (Warehouse) => Promise<void>) {
	let warehouse: Warehouse = null;
	try {
		warehouse = await getWarehouse(configurationPath);
		await handler(warehouse);
	}
	catch (error) {
		onError(error);
	}
	finally {
		if (warehouse != null) {
			warehouse.stop();
			warehouse = null;
		}
	}
}

function onError(error: any) {
	console.error(error.message);
	process.exitCode = 1;
}

main();