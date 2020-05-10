import path from 'path';
import process from 'process';
import minimist from 'minimist';

import { Server } from './server.js';
import * as configurationFile from './configuration.js';
import * as passwordGenerator from './password.js';
import * as common from './common.js';

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
	const createArgument: string = getArgument('c', 'create');
	const adminArgument = getArgument('a', 'admin');
	const deleteArgument: string = getArgument('d', 'delete');
	const resetArgument: string = getArgument('r', 'reset');
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
	else if (resetArgument != null) {
		resetUser(resetArgument, configArgument);
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
		const server = await getServer(configurationPath);
		await server.start();
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
	withServer(configurationPath, async server => {
		await server.initializeDatabase();
		const password = passwordGenerator.generatePassword();
		await server.createUser(username, password, isAdmin);
		console.log(`Created user "${username}" with password "${password}".`);
	});
}

async function deleteUser(username: string, configurationPath: string) {
	withServer(configurationPath, async server => {
		await server.initializeDatabase();
		const success = await server.deleteUser(username);
		if (success) {
			console.log(`Deleted user "${username}".`);
		}
		else {
			console.log(`Unable to find user "${username}".`);
		}
	});
}

async function resetUser(username: string, configurationPath: string) {
	withServer(configurationPath, async server => {
		await server.initializeDatabase();
		const password = passwordGenerator.generatePassword();
		const success = await server.changeUserPassword(username, password);
		console.log(`Reset password of user "${username}" to "${password}".`);
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
		'  -r, --reset=user     Reset the password of a user.',
		'  -C, --config=path    Set the path to the service configuration file.',
		'                       The path defaults to "configuration.json".',
		'  -h, --help           Print help menu.'
	];
	const helpText = helpLines.join('\n');
	console.log(helpText);
}

async function getServer(configurationPath: string): Promise<Server> {
	const configuration = await configurationFile.read(configurationPath);
	const service = new Server(configuration);
	return service;
}

async function withServer(configurationPath: string, handler: (server: Server) => Promise<void>) {
	let server: Server = null;
	try {
		server = await getServer(configurationPath);
		await handler(server);
	}
	catch (error) {
		onError(error);
	}
	finally {
		if (server != null) {
			server.stop();
			server = null;
		}
	}
}

function onError(error: any) {
	const message = common.getErrorString(error);
	console.error(message);
	process.exitCode = 1;
}

main();