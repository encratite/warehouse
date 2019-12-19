import express from 'express';
import http from 'http';
import crypto, { ScryptOptions } from 'crypto';

import { Configuration } from './configuration.js';
import { Database, User } from './database.js';

export class Warehouse {
	configuration: Configuration;
	app: express.Application;
	server: http.Server;
	database: Database;

	constructor(configuration: Configuration) {
		this.configuration = configuration;
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
		this.app.get('/', this.index.bind(this));
		await new Promise((resolve, reject) => {
			this.server = this.app.listen(this.configuration.listenPort, this.configuration.listenHostname, resolve);
			this.server.on('error', reject);
		});
	}

	async initializeDatabase() {
		this.database = new Database();
		await this.database.connect(this.configuration.mongoDbUri);
	}

	async createUser(username: string, password: string, isAdmin: boolean) {
		const saltLength = 32;
		const keyLength = 64;
		const scryptOptions: ScryptOptions = {
			p: 4
		};
		const salt = crypto.randomBytes(saltLength);
		const passwordHash = await new Promise<Buffer>((resolve, reject) => {
			crypto.scrypt(password, salt, keyLength, scryptOptions, (error, derivedKey) => {
				if (error != null) {
					throw error;
				}
				resolve(derivedKey);
			});
		});
		const user = this.database.newUser(name, salt, passwordHash, isAdmin);
		await user.save();
	}

	async deleteUser(username: string) {
		await this.database.user.deleteOne({
			name: username
		});
	}

	generatePassword(): string {
		const characters = this.getPasswordCharacters();
		let password = '';
		for (var i = 0; i < 32; i++) {
			const index = Math.floor(Math.random() * characters.length);
			password += characters.substring(index, index + 1);
		}
		return password;
	}

	getPasswordCharacters(): string {
		const pattern = /[A-Za-z0-9]/;
		let characters = '';
		for (let i = 0; i < 256; i++) {
			const character = String.fromCharCode(i);
			if (pattern.exec(character) != null) {
				characters += character;
			}
		}
		return characters;
	}

	index(request: express.Request, response: express.Response) {
		response.send('Test.');
	}
}