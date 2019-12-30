import express from 'express';
import http from 'http';
import crypto from 'crypto';
import mongodb from 'mongodb';

import { Configuration, deobfuscate } from './configuration.js';
import { Database, User, Session } from './database.js';
import * as common from './common.js';

interface SessionRequest extends express.Request {
	user: User;
}

export class Warehouse {
	static readonly loginPath = '/login';
	static readonly validateSessionPath = '/validate-session';

	static readonly sessionCookieName = 'session';
	static readonly sessionIdEncoding = 'base64';
	static readonly sessionMaxAge = 30 * 24 * 60 * 60;

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

	addMiddleware() {
		const jsonMiddleware = express.json();
		this.app.use(jsonMiddleware);
		const pattern = /--inspect-brk=\d+/;
		const command = process.execArgv.join(' ');
		const debugging = pattern.test(command);
		if (debugging) {
			this.app.use(this.corsMiddleware);
		}
		this.app.use(this.sessionMiddleware);
	}

	corsMiddleware(request: express.Request, response: express.Response, next: () => void) {
		response.header('Access-Control-Allow-Origin', '*');
		response.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
		next();
	}

	async sessionMiddleware(request: express.Request, response: express.Response, next: () => void) {
		if (
			request.path !== Warehouse.loginPath &&
			request.path !== Warehouse.validateSessionPath
		) {
			const user = await this.getSessionUser(request);
			if (user == null) {
				const errorResponse: common.ErrorResponse = {
					error: 'You need an active session to perform this operation.'
				};
				response.status(500);
				response.send(errorResponse);
				return;
			}
			const sessionRequest = <SessionRequest>request;
			sessionRequest.user = user;
		}
		next();
	}

	addRoutes() {
		this.app.post(Warehouse.loginPath, this.login.bind(this));
		this.app.post(Warehouse.validateSessionPath, this.validateSession.bind(this));
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

	async validateSession(request: express.Request, response: express.Response) {
		const user = await this.getSessionUser(request);
		const valid = user != null;
		const validateSessionResponse: common.ValidateSessionResponse = {
			valid: valid
		};
		response.send(validateSessionResponse);
	}

	getAddress(request: express.Request): string {
		return <string>request.headers['x-forwarded-for'] || request.connection.remoteAddress;
	}

	getUserAgent(request: express.Request): string {
		return request.headers['user-agent'];
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
		const sessionId = crypto.randomBytes(sessionIdSize);
		const address = this.getAddress(request);
		const userAgent = this.getUserAgent(request);
		const session = this.database.newSession(user._id, sessionId, address, userAgent);
		await session.save();
		await this.deleteOldSessions(user);
		user.lastLogin = new Date();
		await user.save();
		const sessionIdString = sessionId.toString(Warehouse.sessionIdEncoding);
		const cookieOptions: express.CookieOptions = {
			maxAge: Warehouse.sessionMaxAge,
			httpOnly: true
		};
		response.cookie(Warehouse.sessionCookieName, sessionIdString, cookieOptions);
	}

	async deleteOldSessions(user: User) {
		const maximumSessions = 3;
		const userSessions = await this.database.session.find({
			userId: user._id
		});
		const sessionsToDelete = userSessions.length - maximumSessions;
		if (sessionsToDelete > 0) {
			userSessions.sort((a, b) => b.lastAccess.getTime() - a.lastAccess.getTime());
			const userSessionsToDelete = userSessions.filter((_, i) => i < sessionsToDelete)
			const userSessionIds = userSessionsToDelete.map(userSession => userSession._id);
			await this.database.session.deleteMany({
				id: {
					$in: userSessionIds
				}
			});
		}
	}

	async getSessionUser(request: express.Request): Promise<User> {
		if (request.cookies == null) {
			return null;
		}
		const sessionIdString = <string>request.cookies[Warehouse.sessionCookieName];
		if (sessionIdString == null) {
			return null;
		}
		let sessionId: Buffer;
		try {
			sessionId = Buffer.from(sessionIdString, Warehouse.sessionIdEncoding);
		}
		catch {
			return null;
		}
		const userAgent = this.getUserAgent(request);
		const session = await this.database.session.findOne({
			sessionId: sessionId,
			userAgent: userAgent
		});
		if (session == null) {
			return null;
		}
		const now = new Date();
		const sessionAge = (session.lastAccess.getTime() - now.getTime()) / 1000;
		if (sessionAge >= Warehouse.sessionMaxAge) {
			await this.deleteSession(session);
			return null;
		}
		const user = await this.database.user.findOne({
			id: session.userId
		});
		if (user == null) {
			await this.deleteSession(session);
			return null;
		}
		session.lastAccess = now;
		await session.save();
		return user;
	}

	async deleteSession(session: Session) {
		await this.database.session.deleteOne({
			id: session._id
		});
	};
}