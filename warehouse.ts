import express from 'express';
import http from 'http';
import crypto from 'crypto';
import mongodb from 'mongodb';
import cookie from 'cookie';

import * as configurationFile from './configuration.js';
import { Database, User, Session } from './database.js';
import * as common from './common.js';

interface SessionRequest extends express.Request {
	user: User;
}

export class Warehouse {
	static readonly cryptoSaltLength = 32;
	static readonly cryptoKeyLength = 64;
	static readonly cryptoParallelization = 4;

	static readonly loginPath = '/login';
	static readonly validateSessionPath = '/validate-session';

	static readonly sessionCookieName = 'session';
	static readonly sessionIdEncoding = 'base64';
	static readonly sessionIdLength = 32;
	// Maximum age of sessions, in seconds.
	static readonly sessionMaxAge = 30 * 24 * 60 * 60;
	static readonly maximumSessionsPerUser = 3;

	configuration: configurationFile.Configuration;
	app: express.Application;
	server: http.Server;
	database: Database;

	constructor(configuration: configurationFile.Configuration) {
		this.configuration = configuration;
		configurationFile.deobfuscate(this.configuration);
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
		this.app.use(this.originMiddleware.bind(this));
		this.app.use(this.sessionMiddleware.bind(this));
	}

	originMiddleware(request: express.Request, response: express.Response, next: () => void) {
		const origin = <string>request.headers.origin;
		if (origin != null) {
			const originUrl = new URL(origin);
			if (originUrl.host !== this.configuration.listenHostname) {
				this.sendErrorResponse('Invalid request origin.', response);
				return;
			}
		}
		next();
	}

	async sessionMiddleware(request: express.Request, response: express.Response, next: () => void) {
		if (
			request.path !== Warehouse.loginPath &&
			request.path !== Warehouse.validateSessionPath
		) {
			const user = await this.getSessionUser(request);
			if (user == null) {
				this.sendErrorResponse('You need an active session to perform this operation.', response);
				return;
			}
			const sessionRequest = <SessionRequest>request;
			sessionRequest.user = user;
		}
		next();
	}

	sendErrorResponse(message: string, response: express.Response) {
		const errorResponse: common.ErrorResponse = {
			error: message
		};
		const httpStatusForbidden = 403;
		response.status(httpStatusForbidden);
		response.send(errorResponse);
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
		const salt = crypto.randomBytes(Warehouse.cryptoSaltLength);
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
		// This exception is raised in case of unique index constraints having been violated.
		return error instanceof mongodb.MongoError && error.code === 11000;
	}

	async hashPassword(password: string, salt: Buffer): Promise<Buffer> {
		// Use default CPU/memory cost and blocksize parameters but increase parallelization.
		const scryptOptions: crypto.ScryptOptions = {
			p: Warehouse.cryptoParallelization
		};
		const passwordHash = await new Promise<Buffer>((resolve, reject) => {
			crypto.scrypt(password, salt, Warehouse.cryptoKeyLength, scryptOptions, (error, derivedKey) => {
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
		// nginx requires a corresponding X-Real-IP header for the proxy_pass.
		return <string>request.headers['x-real-ip'] || request.connection.remoteAddress;
	}

	getUserAgent(request: express.Request): string {
		return request.headers['user-agent'];
	}

	async createSessionWithRetry(request: express.Request, response: express.Response, user: User) {
		while (true) {
			try {
				// Keep on generating sessions until a unique session ID has been found.
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
		const sessionId = crypto.randomBytes(Warehouse.sessionIdLength);
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
		const userSessions = await this.database.session.find({
			userId: user._id
		});
		const sessionsToDelete = userSessions.length - Warehouse.maximumSessionsPerUser;
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
		const requestCookies = request.headers.cookie;
		if (requestCookies == null) {
			return null;
		}
		const cookies = cookie.parse(requestCookies);
		const sessionIdString = cookies[Warehouse.sessionCookieName];
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
		const sessionAge = (now.getTime() - session.lastAccess.getTime()) / 1000;
		if (sessionAge >= Warehouse.sessionMaxAge) {
			// The session has expired, delete it.
			await this.deleteSession(session);
			return null;
		}
		const user = await this.database.user.findOne({
			id: session.userId
		});
		if (user == null) {
			// Orphaned session that lacks a corresponding user, delete it.
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