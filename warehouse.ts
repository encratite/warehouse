import express from 'express';
import http from 'http';
import crypto from 'crypto';

import { Configuration, deobfuscate } from './configuration.js';
import { Database } from './database.js';
import * as common from './common.js';

export class Warehouse {
	configuration: Configuration;
	app: express.Application;
	server: http.Server;
	database: Database;

	constructor(configuration: Configuration) {
		this.configuration = configuration;
		deobfuscate(this.configuration);
	}

	async start() {
		try {
			await Promise.all([
				this.initializeWeb(),
				this.initializeDatabase()
			]);
			console.log(`Listening on ${this.configuration.listenHostname}:${this.configuration.listenPort}.`);
		}
		catch (error) {
			this.stop();
			throw error;
		}
	}

	stop() {
		if (this.server != null) {
			this.server.close();
			this.app = null;
			this.server = null;
		}
		if (this.database != null) {
			this.database.close();
			this.database = null;
		}
	}

	async initializeWeb() {
		this.app = express();
		this.addMiddleware();
		this.addRoutes();
		await new Promise((resolve, reject) => {
			this.server = this.app.listen(this.configuration.listenPort, this.configuration.listenHostname, resolve);
			this.server.on('error', reject);
		});
	}

	corsMiddleware(request: express.Request, response: express.Response, next: () => void) {
		response.header('Access-Control-Allow-Origin', '*');
		response.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
		next();
	}

	addMiddleware() {
		const jsonMiddleware = express.json();
		this.app.use(jsonMiddleware);
		const pattern = /--inspect-brk=\d+/;
		const command = process.execArgv.join(' ');
		const debugging = pattern.test(command);
		if (debugging) {
			this.app.use(this.corsMiddleware);
		}
	}

	addRoutes() {
		this.app.post('/login', this.login.bind(this));
	}

	async initializeDatabase() {
		this.database = new Database();
		await this.database.connect(this.configuration.mongoDbUri);
	}

	async createUser(username: string, password: string, isAdmin: boolean) {
		const saltLength = 32;
		const salt = crypto.randomBytes(saltLength);
		const passwordHash = await this.hashPassword(password, salt);
		const user = this.database.newUser(name, salt, passwordHash, isAdmin);
		await user.save();
	}

	async hashPassword(password: string, salt: Buffer): Promise<Buffer> {
		const keyLength = 64;
		const scryptOptions: crypto.ScryptOptions = {
			p: 4
		};
		const passwordHash = await new Promise<Buffer>((resolve, reject) => {
			crypto.scrypt(password, salt, keyLength, scryptOptions, (error, derivedKey) => {
				if (error != null) {
					throw error;
				}
				resolve(derivedKey);
			});
		});
		return passwordHash;
	}

	async deleteUser(username: string) {
		await this.database.user.deleteOne({
			name: username
		});
	}

	async login(request: express.Request, response: express.Response) {
		const loginRequest = <common.LoginRequest>request.body;
		this.database.user.findOne({ username: loginRequest.username }, (error, user) => {
			console.log(error, user);
		});
		throw new Error('Not implemented.');
	}
}