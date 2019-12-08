import * as express from 'express';
import * as mongoose from 'mongoose';
import * as http from 'http';

import { Configuration } from './configuration.js';

export class Warehouse {
	configuration: Configuration;
	app: express.Application;
	server: http.Server;
	db: mongoose.Connection;

	constructor(configuration: Configuration) {
		this.configuration = configuration;
	}

	async start() {
		try {
			await Promise.all([
				this.initializeWeb,
				this.initializeDatabase
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
		if (this.db != null) {
			this.db.close();
			this.db = null;
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
		const options: mongoose.ConnectionOptions = {
			useNewUrlParser: true
		};
		const connection = await mongoose.connect(this.configuration.mongoDbUri, options, (error) => {
			if (error != null) {
				throw error;
			}
		});
		this.db = connection.connection;
	}

	index(request: express.Request, response: express.Response) {
		response.send('Test.');
	}
}