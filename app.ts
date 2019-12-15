import fs from 'fs';
import path from 'path';
import process from 'process';
import minimist from 'minimist';

import { Warehouse } from './warehouse.js';
import { Configuration } from './configuration.js';

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
	const createArgument = getArgument('c', 'create');
	const adminArgument = getArgument('a', 'admin');
	const deleteArgument = getArgument('d', 'delete');
	const helpArgument = getArgument('h', 'help');

	if (serviceArgument === true) {
		startService();
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
		const warehouse = getWarehouse();
		await warehouse.start();
	}
	catch (error) {
		onError(error);
	}
}

async function createUser(username: string, isAdmin: boolean) {
	try {
		const warehouse = getWarehouse();
		const password = warehouse.generatePassword();
		await warehouse.createUser(username, password, isAdmin);
		console.log(`Created user "${username}" with password "${password}".`);
	}
	catch (error) {
		onError(error);
	}
}

async function deleteUser(username: string) {
	try {
		const warehouse = getWarehouse();
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
		'  -c, --create=user    Create a new user with a random password.',
		'  -a, --admin          When creating a new user, make that user an admin.',
		'                       Only works in combination with -c.',
		'  -d, --delete=user    Delete a user.',
		'  -h, --help           Print help menu.'
	];
	const helpText = helpLines.join('\n');
	console.log(helpText);
}

function readConfiguration(): Configuration {
	const configurationJson = fs.readFileSync('configuration.json', 'utf8');
	const configuration = <Configuration>JSON.parse(configurationJson);
	return configuration;
}

function getWarehouse(): Warehouse {
	const configuration = readConfiguration();
	const warehouse = new Warehouse(configuration);
	return warehouse;
}

function onError(error: any) {
	console.error(error.message);
	process.exitCode = 1;
}

main();