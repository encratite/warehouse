import express from 'express';
import mongoose from 'mongoose';
import http from 'http';

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

	async createUser(username: string, password: string, isAdmin: boolean): Promise<User> {
		throw new Error('Not implemented.');
	}

	async deleteUser(username: string) {
		throw new Error('Not implemented.');
	}

	generatePassword(): string {
		throw new Error('Not implemented.');
	}

	index(request: express.Request, response: express.Response) {
		response.send('Test.');
	}
}