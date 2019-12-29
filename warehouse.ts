import express from 'express';
import http from 'http';
import crypto from 'crypto';
import mongodb from 'mongodb';

import { Configuration, deobfuscate } from './configuration.js';
import { Database, User } from './database.js';
import * as common from './common.js';

export class Warehouse {
	sessionCookieName = 'session';

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
		const user = this.database.newUser(username, salt, passwordHash, isAdmin);
		try {
			await user.save();
		}
		catch (error) {
			if (this.isDuplicateKeyError(error) === true) {
				throw new Error('Unable to create user. Username already in use.');
			}
			else {
				throw error;
			}
		}
	}

	isDuplicateKeyError(error): boolean {
		return error instanceof mongodb.MongoError && error.code === 11000;
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

	async deleteUser(username: string): Promise<boolean> {
		const result = await this.database.user.deleteOne({ name: username }, error => {
			if (error != null) {
				throw error;
			}
		});
		const success = result.deletedCount > 0;
		return success;
	}

	async login(request: express.Request, response: express.Response) {
		const loginRequest = <common.LoginRequest>request.body;
		const user = await new Promise<User>((resolve, reject) => {
			this.database.user.findOne({ name: loginRequest.username }, (error, user) => {
				if (error != null) {
					throw error;
				}
				resolve(user);
			});
		});
		let success = false;
		if (user != null) {
			const passwordHash = await this.hashPassword(loginRequest.password, user.salt);
			if (Buffer.compare(passwordHash, user.password) === 0) {
				await this.createSessionWithRetry(request, response, user);
				success = true;
			}
		}
		const loginResponse: common.LoginResponse = {
			success: success
		};
		response.send(loginResponse);
	}

	getAddress(request: express.Request): string {
		return <string>request.headers['x-forwarded-for'] || request.connection.remoteAddress;
	}

	async createSessionWithRetry(request: express.Request, response: express.Response, user: User) {
		while (true) {
			try {
				await this.createSession(request, response, user);
				break;
			}
			catch (error) {
				if (this.isDuplicateKeyError(error) === false) {
					throw error;
				}
			}
		}
	}

	async createSession(request: express.Request, response: express.Response, user: User) {
		const sessionIdSize = 32;
		const cookieMaxAge = 30 * 24 * 60 * 60;
		const sessionId = crypto.randomBytes(sessionIdSize);
		const address = this.getAddress(request);
		const userAgent = request.headers['user-agent'];
		const session = this.database.newSession(user._id, sessionId, address, userAgent);
		await session.save();
		await this.deleteOldSessions(user);
		const sessionIdString = sessionId.toString('base64');
		const cookieOptions: express.CookieOptions = {
			maxAge: cookieMaxAge,
			httpOnly: true
		};
		response.cookie(this.sessionCookieName, sessionIdString, cookieOptions);
	}

	async deleteOldSessions(user: User) {
		const maximumSessions = 3;
		const findQuery = this.database.session.find({ userId: user._id });
		const userSessions = await findQuery.exec();
		const sessionsToDelete = userSessions.length - maximumSessions;
		if (sessionsToDelete > 0) {
			userSessions.sort((a, b) => b.lastAccess.getTime() - a.lastAccess.getTime());
			const userSessionsToDelete = userSessions.filter((_, i) => i < sessionsToDelete)
			const userSessionIds = userSessionsToDelete.map(userSession => userSession._id);
			const deleteQuery = this.database.session.deleteMany({ id: { $in: userSessionIds } });
			await deleteQuery.exec();
		}
	}
}