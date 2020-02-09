import express from 'express';
import http from 'http';
import crypto from 'crypto';
import mongodb from 'mongodb';
import mongoose from 'mongoose';
import cookie from 'cookie';
import transmission from 'transmission';
import uuidv1 from 'uuid/v1';
import checkDiskSpace from 'check-disk-space';

import * as configurationFile from './configuration.js';
import { Database, User, Session, Subscription } from './database.js';
import * as common from './common.js';
import { TorrentSite } from './site.js';
import { TorrentLeech } from './torrentleech.js';
import * as validate from './validate.js';
import { generatePassword } from './password.js';
import * as logging from './logging.js';

interface SessionRequest extends express.Request {
	user: User;
	session: Session;
}

export class Warehouse {
	static readonly cryptoSaltLength = 32;
	static readonly cryptoKeyLength = 64;
	static readonly cryptoParallelization = 4;

	static readonly sessionCookieName = 'session';
	static readonly sessionIdEncoding = 'base64';
	static readonly sessionIdLength = 32;
	// Maximum age of sessions, in seconds.
	static readonly sessionMaxAge = 30 * 24 * 60 * 60;
	static readonly maxSessionsPerUser = 3;

	static readonly maxSubscribersShown = 5;

	static readonly bytesPerGigabyte = Math.pow(1024, 3);

	configuration: configurationFile.Configuration;
	running: boolean = false;
	app: express.Application;
	server: http.Server;
	database: Database;
	whitelistedPaths: string[] = [];
	sites: TorrentSite[];
	releaseCache: Map<string, Set<number>>;
	transmission: transmission.TransmissionClient;
	subscriptionInterval: NodeJS.Timeout;
	freeDiskSpaceInterval: NodeJS.Timeout;

	constructor(configuration: configurationFile.Configuration) {
		this.configuration = configuration;
		configurationFile.deobfuscate(this.configuration);
		this.initializeSites();
		this.transmission = transmission(configuration.transmission);
	}

	async start() {
		if (this.running === true) {
			throw new Error('Service is already running.');
		}
		try {
			await logging.initialize(this.configuration.logPath);
			await Promise.all([
				this.initializeWeb(),
				this.initializeDatabase()
			]);
			this.setIntervals();
			this.running = true;
			logging.log(`Listening on ${this.configuration.listenHostname}:${this.configuration.listenPort}.`);
		}
		catch (error) {
			this.stop();
			throw error;
		}
	}

	stop(checkState: boolean = true) {
		if (checkState === true && this.running === true) {
			throw new Error('Service is already running.');
		}
		if (this.subscriptionInterval != null) {
			clearInterval(this.subscriptionInterval);
		}
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

	initializeSites() {
		this.sites = [
			new TorrentLeech()
		];
		if (this.configuration.sites != null) {
			this.sites.forEach(site => {
				const settings = this.configuration.sites.find(siteSettings => siteSettings.name === site.name);
				if (settings == null) {
					throw new Error(`Unable to find settings for site "${site.name}".`);
				}
				site.initialize(settings);
			});
		}
		this.sites.forEach(site => {
			if (this.releaseCache.has(site.name) === false) {
				this.releaseCache[site.name] = new Set();
			}
		});
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
		this.app.use(
			express.json(),
			this.originMiddleware.bind(this),
			this.sessionMiddleware.bind(this)
		);
	}

	// Check HTTP Origin header to prevent cross-site request forgery.
	originMiddleware(request: express.Request, response: express.Response, next: () => void) {
		const origin = <string>request.headers.origin;
		if (origin != null) {
			const originUrl = new URL(origin);
			if (originUrl.hostname !== this.configuration.externalHostname) {
				this.sendErrorResponse('Invalid request origin.', response);
				return;
			}
		}
		next();
	}

	// Prevent access to most API functions without a valid session.
	async sessionMiddleware(request: express.Request, response: express.Response, next: () => void) {
		// Whitelisted paths are exempt from session checks.
		if (this.whitelistedPaths.includes(request.path) === false) {
			const session = await this.getSession(request);
			const user = await this.getSessionUser(session);
			if (user == null) {
				this.sendErrorResponse('You need to be logged in to perform this operation.', response);
				return;
			}
			const sessionRequest = <SessionRequest>request;
			sessionRequest.user = user;
			sessionRequest.session = session;
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
		this.addRoute('/login', this.login.bind(this), true);
		this.addRoute('/logout', this.logout.bind(this));
		this.addRoute('/validate-session', this.validateSession.bind(this), true);
		this.addRoute('/search', this.search.bind(this));
		this.addRoute('/download', this.download.bind(this));
		this.addRoute('/get-torrents', this.getTorrents.bind(this));
		this.addRoute('/get-subscriptions', this.getSubscriptions.bind(this));
		this.addRoute('/create-subscription', this.createSubscription.bind(this));
		this.addRoute('/delete-subscription', this.deleteSubscription.bind(this));
	}

	addRoute(path: string, handler: (request: express.Request, response: express.Response) => Promise<void>, whitelistPath: boolean = false) {
		if (whitelistPath === true) {
			this.whitelistedPaths.push(path);
		}
		this.app.post(path, async (request: express.Request, response: express.Response) => {
			try {
				await handler(request, response);
			}
			catch (error) {
				const message = error.toString();
				this.sendErrorResponse(message, response);
			}
		});
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
				if (error == null) {
					resolve(derivedKey);
				}
				else {
					reject(error);
				}
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
		validate.string('username', loginRequest.username);
		validate.string('password', loginRequest.password);

		const user = await new Promise<User>((resolve, reject) => {
			this.database.user.findOne({ name: loginRequest.username }, (error, user) => {
				if (error == null) {
					resolve(user);
				}
				else {
					reject(error);
				}
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

	async logout(request: SessionRequest, response: express.Response) {
		await this.database.session.findByIdAndDelete(request.session._id);
		response.send({});
	}

	async validateSession(request: express.Request, response: express.Response) {
		const session = await this.getSession(request);
		const user = await this.getSessionUser(session);
		const valid = user != null;
		const validateSessionResponse: common.ValidateSessionResponse = {
			valid: valid
		};
		response.send(validateSessionResponse);
	}

	async search(request: SessionRequest, response: express.Response) {
		const searchRequest = <common.SearchRequest>request.body;
		validate.string('site', searchRequest.site);
		validate.string('query', searchRequest.query);
		validate.array('categories', searchRequest.categories, true);
		searchRequest.categories.forEach(category => {
			validate.number('categories[i]', category);
		});
		validate.number('page', searchRequest.page);

		const site = this.getSite(searchRequest.site);
		const searchResponse: common.SearchResponse = await site.search(searchRequest.query, searchRequest.categories, searchRequest.page);
		response.send(searchResponse);
	}

	async download(request: SessionRequest, response: express.Response) {
		const downloadRequest = <common.DownloadRequest>request.body;
		validate.string('site', downloadRequest.site);
		validate.number('id', downloadRequest.id);

		const site = this.getSite(downloadRequest.site);
		await this.performSizeCheck(downloadRequest.id, site, request);
		const torrentFile = await site.download(downloadRequest.id);
		// Retrieve the current list of torrent IDs to determine if the torrent had already been added.
		const getIdResponse = await this.transmissionGetTorrents(null, ['id']);
		const addTorrentResponse = await this.transmissionQueueTorrent(torrentFile);
		// Check if the ID returned by the service matches that of any of the torrents previously retrieved.
		const hadAlreadyBeenAdded = getIdResponse.torrents.some(torrent => torrent.id === addTorrentResponse.id);
		if (hadAlreadyBeenAdded === false) {
			// Retrieve the size of the torrent.
			const getSizeResponse = await this.transmissionGetTorrents([addTorrentResponse.id], ['name', 'totalSize']);
			let totalSize: number = null;
			if (getSizeResponse.torrents.length === 1) {
				totalSize = getSizeResponse.torrents[0].totalSize;
			}
			else {
				logging.error(`Failed to determine size of torrent "${addTorrentResponse.name}" (ID ${addTorrentResponse.id}).`);
			}
			// Log the download in the database.
			const download = this.database.newDownload(request.session.userId, addTorrentResponse.name, totalSize, true);
			await download.save();
			response.send({});
		}
		else {
			this.sendErrorResponse('This torrent had already been added.', response);
		}
	}

	async getTorrents(request: SessionRequest, response: express.Response) {
		const torrentResponse = await this.transmissionGetTorrents(null, [
			'dateCreated',
			'name',
			'peers',
			'rateDownload',
			'rateUpload',
			'status',
			'totalSize'
		]);
		const torrentStates = torrentResponse.torrents.map(torrent => this.convertTorrent(torrent));
		const getTorrentResponse: common.GetTorrentResponse = {
			torrents: torrentStates
		};
		response.send(getTorrentResponse);
	}

	async getSubscriptions(request: SessionRequest, response: express.Response) {
		const getSubscriptionRequest = <common.GetSubscriptionRequest>request.body;
		validate.boolean('all', getSubscriptionRequest.all);
		validate.string('userId', getSubscriptionRequest.userId, true)

		const conditions: any = {};
		if (getSubscriptionRequest.all === true) {
			// The user requested a list of all subscriptions.
			this.adminCheck(request);
		}
		else {
			if (getSubscriptionRequest.userId != null) {
				// The user requested a list of subscriptions of a particular user.
				this.adminCheck(request);
				conditions._id = mongoose.Types.ObjectId(getSubscriptionRequest.userId);
			}
			else {
				// The user requested a list of their own subscriptions.
				conditions._id = request.session.userId;
			}
		}
		const subscriptions = await this.database.subscription.find(conditions);
		const responseSubscriptions = subscriptions.map(subscription => this.convertSubscription(subscription));
		const getSubscriptionResopnse: common.GetSubscriptionResponse = {
			subscriptions: responseSubscriptions
		};
		response.send(getSubscriptionResopnse);
	}

	async createSubscription(request: SessionRequest, response: express.Response) {
		const createSubscriptionRequest = <common.CreateSubscriptionRequest>request.body;
		validate.string('pattern', createSubscriptionRequest.pattern);
		validate.string('category', createSubscriptionRequest.category);

		this.validatePattern(createSubscriptionRequest.pattern);
		const subscription = this.database.newSubscription(request.session.userId, createSubscriptionRequest.pattern, createSubscriptionRequest.category);
		const persistedSubscription = await subscription.save();
		const createSubscriptionResponse: common.CreateSubscriptionResponse = {
			subscriptionId: persistedSubscription._id.toString()
		};
		response.send(createSubscriptionResponse);
	}

	async deleteSubscription(request: SessionRequest, response: express.Response) {
		const deleteSubscriptionRequest = <common.DeleteSubscriptionRequest>request.body;
		validate.string('subscriptionId', deleteSubscriptionRequest.subscriptionId);

		const conditions: any = {
			_id: mongoose.Types.ObjectId(deleteSubscriptionRequest.subscriptionId)
		};
		// Only admins may delete the subscriptions of other users.
		if (request.user.isAdmin === false) {
			conditions.userId = request.session.userId;
		}
		const result = await this.database.subscription.deleteOne(conditions);
		if (result.deletedCount === 0) {
			throw new Error('Invalid subscription ID.');
		}
	}

	convertTorrent(torrent: transmission.Torrent): common.TorrentState {
		const added = new Date(1000 * torrent.addedDate);
		return {
			name: torrent.name,
			downloadSpeed: torrent.rateDownload,
			uploadSpeed: torrent.rateUpload,
			peers: torrent.peers.length,
			size: torrent.totalSize,
			state: torrent.status,
			added: added.toISOString()
		};
	}

	convertSubscription(subscription: Subscription): common.Subscription {
		return {
			pattern: subscription.pattern,
			category: subscription.category,
			matches: subscription.matches,
			created: subscription.created.toISOString(),
			lastMatch: subscription.lastMatch.toISOString()
		};
	}

	validatePattern(pattern: string) {
		let regExp: RegExp;
		try {
			regExp = new RegExp(pattern);
		}
		catch {
			throw new Error('You have specified an invalid regular expression.');
		}
		const randomString = generatePassword();
		const testString = `${randomString}.S01E02.720p.1080p`;
		const match = regExp.exec(testString);
		if (match != null) {
			throw new Error('Your regular expression matches too many release names.');
		}
	}

	adminCheck(request: SessionRequest) {
		if (request.user.isAdmin === false) {
			throw new Error('Only administrators may perform this operation.');
		}
	}

	async transmissionGetTorrents(ids: number[], fields: string[]): Promise<transmission.GetTorrentResponse> {
		const options = {
			arguments: {
				ids: ids,
				fields: fields
			},
			method: 'torrent-get',
			tag: uuidv1()
		};
		if (ids == null) {
			delete options.arguments.ids;
		}
		const getTorrentResponse = await new Promise<transmission.GetTorrentResponse>((resolve, reject) => {
			this.transmission.callServer(options, (error: Error, response: transmission.GetTorrentResponse) => {
				if (error == null) {
					resolve(response);
				}
				else {
					reject(error);
				}
			});
		});
		return getTorrentResponse;
	}

	async transmissionQueueTorrent(torrentFile: Buffer): Promise<transmission.Torrent> {
		const torrentFileString = torrentFile.toString('base64');
		const addTorrentResponse = await new Promise<transmission.Torrent>((resolve, reject) => {
			this.transmission.addBase64(torrentFileString, {}, (error, torrent) => {
				if (error == null) {
					resolve(torrent);
				}
				else {
					reject(error);
				}
			});
		});
		return addTorrentResponse;
	}

	async transmissionDeleteTorrents(ids: number[], deleteTorrent: boolean): Promise<void> {
		await new Promise((resolve, reject) => {
			this.transmission.remove(ids, deleteTorrent, error => {
				if (error == null) {
					resolve();
				}
				else {
					reject(error);
				}
			});
		});
	}

	getSite(name: string): TorrentSite {
		const site = this.sites.find(browseSite => browseSite.name === name);
		if (site == null) {
			throw new Error('No such site.');
		}
		return site;
	}

	getAddress(request: express.Request): string {
		// nginx requires a corresponding X-Real-IP header for the proxy_pass.
		const realIp = <string>request.headers['x-real-ip'];
		if (realIp == null) {
			throw new Error('Missing X-Real-IP header.');
		}
		return realIp;
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
		const sessionsToDelete = userSessions.length - Warehouse.maxSessionsPerUser;
		if (sessionsToDelete > 0) {
			userSessions.sort((a, b) => a.lastAccess.getTime() - b.lastAccess.getTime());
			const userSessionsToDelete = userSessions.filter((_, i) => i < sessionsToDelete)
			const userSessionIds = userSessionsToDelete.map(userSession => userSession._id);
			await this.database.session.deleteMany({
				_id: {
					$in: userSessionIds
				}
			});
		}
	}

	async getSession(request: express.Request): Promise<Session> {
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
		return session;
	}

	async getSessionUser(session: Session): Promise<User> {
		if (session == null) {
			return null;
		}
		const user = await this.database.user.findById(session.userId);
		if (user == null) {
			// Orphaned session that lacks a corresponding user, delete it.
			await this.deleteSession(session);
			return null;
		}
		const now = new Date();
		session.lastAccess = now;
		await session.save();
		return user;
	}

	async deleteSession(session: Session) {
		await this.database.session.findByIdAndDelete(session._id);
	}

	setIntervals() {
		this.subscriptionInterval = this.setInterval(this.onSubscriptionTimer.bind(this), this.configuration.subscriptionInterval);
		this.freeDiskSpaceInterval = this.setInterval(this.onFreeDiskSpaceTimer.bind(this), this.configuration.freeDiskSpace.interval);
	}

	setInterval(handler: () => void, seconds: number) {
		const milliseconds = 1000 * seconds;
		const timeout = setInterval(handler, milliseconds);
		return timeout;
	}

	async onSubscriptionTimer() {
		try {
			const subscriptions = await this.database.subscription.find({});
			if (subscriptions.length === 0) {
				// The system does not have any subscriptions yet so there is no reason to poll the sites.
				return;
			}
			// Run subscription checks in parallel.
			const checks = this.sites.map(site => this.checkNewTorrents(site, subscriptions));
			await Promise.all(checks);
		}
		catch (error) {
			logging.error(`Subscription check failed: ${error.message}`);
		}
	}

	async onFreeDiskSpaceTimer() {
		try {
			const diskSpaceInfo = await checkDiskSpace(this.configuration.freeDiskSpace.path);
			const minBytes = Warehouse.bytesPerGigabyte * this.configuration.freeDiskSpace.min;
			let diskSpaceToFree = Math.floor(minBytes - diskSpaceInfo.free);
			if (diskSpaceToFree > 0) {
				// The system is running out of disk space.
				// Start deleting torrents, commencing with the oldest ones.
				const response = await this.transmissionGetTorrents(null, [
					'id',
					'name',
					'dateAdded',
					'totalSize'
				]);
				const torrents = response.torrents;
				if (torrents.length > 0) {
					torrents.sort((x, y) => x.addedDate - y.addedDate);
					const torrentsToDelete: transmission.Torrent[] = [];
					for (let i = 0; i < torrents.length && diskSpaceToFree > 0; i++) {
						const torrent = torrents[i];
						torrentsToDelete.push(torrent);
						diskSpaceToFree -= torrent.totalSize;
					}
					const ids = torrentsToDelete.map(torrent => torrent.id);
					await this.transmissionDeleteTorrents(ids, true);
					torrentsToDelete.forEach(torrent => {
						logging.log(`Deleted torrent "${torrent.name}" (${this.getSizeString(torrent.totalSize)}).`);
					});
					const newDiskSpaceInfo = await checkDiskSpace(this.configuration.freeDiskSpace.path);
					logging.log(`Deleted ${torrentsToDelete.length} torrent(s) to free disk space (${this.getSizeString(newDiskSpaceInfo.free)} available).`);
				}
				else {
					logging.warn(`Running out of disk space (${this.getSizeString(diskSpaceInfo.free)} available) without having any torrents in Transmission.`);
				}
			}
		}
		catch (error) {
			logging.error(`Free disk space check failed: ${error.message}`);
		}
	}

	getSizeString(size: number): string {
		const gigabytes = size / Warehouse.bytesPerGigabyte;
		return `${gigabytes.toFixed(2)} GiB`;
	}

	async checkNewTorrents(site: TorrentSite, subscriptions: Subscription[]) {
		const cache: Set<number> = this.releaseCache[site.name];
		const cacheWasEmpty = cache.size === 0;
		let pages: number = null;
		for (let page = 1; pages === null || page <= pages; page++) {
			const browseResults = await site.browse(page);
			const torrents = browseResults.torrents;
			pages = browseResults.pages;
			let foundNewTorrents = false;
			for (let i = 0; i < torrents.length; i++) {
				const torrent = torrents[i];
				if (cache.has(torrent.id) === false) {
					foundNewTorrents = true;
					cache.add(torrent.id);
					await this.checkNewTorrent(torrent, subscriptions, site);
				}
			}
			if (cacheWasEmpty === true) {
				break;
			}
			else if (foundNewTorrents === false) {
				logging.log('Found no new torrents.');
				break;
			}
		}
	}

	async checkNewTorrent(torrent: common.Torrent, subscriptions: Subscription[], site: TorrentSite) {
		const matchingSubscriptions: Subscription[] = [];
		subscriptions.forEach(subscription => {
			const pattern = new RegExp(subscription.pattern);
			const match = pattern.exec(torrent.name);
			if (match != null) {
				matchingSubscriptions.push(subscription);
			}
		});
		if (matchingSubscriptions.length > 0) {
			const torrentSizeLimit = this.getTorrentSizeLimit();
			if (torrent.size <= torrentSizeLimit) {
				await this.onSubscriptionMatch(torrent, matchingSubscriptions, site);
			}
			else {
				logging.warn(`Ignoring torrent "${torrent.name}" because its size (${this.getSizeString(torrent.size)}) exceeds the system limit of ${this.getSizeString(torrentSizeLimit)}.`);
			}
		}
		else {
			logging.log(`No matching subscription for new release ${torrent.name} (ID ${torrent.id}).`);
		}
	}

	async onSubscriptionMatch(torrent: common.Torrent, matchingSubscriptions: Subscription[], site: TorrentSite) {
		await this.printSubscriptionData(torrent, matchingSubscriptions);
		const matchingSubscriptionIds = matchingSubscriptions.map(subscription => subscription._id);
		const now = new Date();
		await this.database.subscription.updateMany({
			_id: {
				$in: matchingSubscriptionIds
			}
		},
			{
				$inc: {
					matches: 1
				},
				$set: {
					lastMatch: now
				}
			}
		);
		try {
			const torrentBuffer = await site.download(torrent.id);
			await this.transmissionQueueTorrent(torrentBuffer);
			logging.log(`Successfully queued torrent "${torrent.name}".`);
		}
		catch (error) {
			logging.error(`Failed to queue torrent "${torrent.name}" (ID ${torrent.id}): ${error.message}`);
		}
	}

	async printSubscriptionData(torrent: common.Torrent, matchingSubscriptions: Subscription[]) {
		const matchingUserIds = new Set<mongoose.Types.ObjectId>();
		matchingSubscriptions.forEach(subscription => {
			matchingUserIds.add(subscription.userId);
		});
		const matchingUserIdArray = Array.from(matchingUserIds);
		let addEllipsis = false;
		if (matchingUserIdArray.length > Warehouse.maxSubscribersShown) {
			// Limit the number of matching users in order to avoid flooding and also to reduce the database load.
			matchingUserIdArray.splice(Warehouse.maxSubscribersShown);
			addEllipsis = true;
		}
		const matchingUsers = await this.database.user.find({
			_id: {
				$in: matchingUserIdArray
			}
		});
		const usernames = matchingUsers.map(user => user.name);
		if (addEllipsis === true) {
			usernames.push('...');
		}
		logging.log(`Found ${matchingSubscriptions.length} matching subscription(s) (${usernames.join(', ')}) for new release "${torrent.name}" (ID ${torrent.id}).`);
	}

	async performSizeCheck(id: number, site: TorrentSite, request: SessionRequest) {
		if (request.user.isAdmin === false) {
			// Make sure that the size of the release does not exceed the limit set in the service configuration.
			const torrentInfo = await site.getInfo(id);
			const torrentSizeLimit = this.getTorrentSizeLimit();
			if (torrentInfo.size > torrentSizeLimit) {
				throw new Error(`The size of the release (${this.getSizeString(torrentInfo.size)}) exceeds the system limit of ${this.getSizeString(torrentSizeLimit)}.`);
			}
		}
	}

	getTorrentSizeLimit(): number {
		return Warehouse.bytesPerGigabyte * this.configuration.torrentSizeLimit;
	}
}