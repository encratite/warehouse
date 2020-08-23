import mongoose from 'mongoose';

export interface User extends mongoose.Document {
	name: string;
	salt: Buffer;
	password: Buffer;
	isAdmin: boolean;
	created: Date;
	lastLogin: Date;
}

export interface Session extends mongoose.Document {
	userId: mongoose.Types.ObjectId;
	sessionId: Buffer;
	address: string;
	userAgent: string;
	created: Date;
	lastAccess: Date;
}

export interface Subscription extends mongoose.Document {
	userId: mongoose.Types.ObjectId;
	pattern: string;
	category: string;
	matches: number;
	created: Date;
	lastMatch: Date;
}

export interface Blocklist extends mongoose.Document {
	userId: mongoose.Types.ObjectId;
	patterns: string[];
}

export interface Download extends mongoose.Document {
	userId: mongoose.Types.ObjectId;
	time: Date;
	name: string;
	size: number;
	manual: boolean;
}

const userModelName = 'user';
const sessionModelName = 'session';
const subscriptionModelName = 'subscription';
const blocklistModelName = 'blocklist';
const downloadModelName = 'download';

const userSchema = new mongoose.Schema({
	name: {
		type: String,
		required: true,
		index: true,
		unique: true
	},
	salt: {
		type: Buffer,
		required: true
	},
	password: {
		type: Buffer,
		required: true
	},
	isAdmin: {
		type: Boolean,
		required: true
	},
	created: {
		type: Date,
		required: true,
		default: Date.now
	},
	lastLogin: {
		type: Date
	}
});

const sessionSchema = new mongoose.Schema({
	userId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: userModelName,
		required: true,
		index: true
	},
	sessionId: {
		type: Buffer,
		required: true,
		unique: true
	},
	address: {
		type: String,
		required: true
	},
	userAgent: {
		type: String
	},
	created: {
		type: Date,
		required: true,
		default: Date.now
	},
	lastAccess: {
		type: Date,
		required: true,
		default: Date.now
	}
});
sessionSchema.index({ sessionId: 1, userAgent: 1 });

const subscriptionSchema = new mongoose.Schema({
	userId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: userModelName,
		required: true,
		index: true
	},
	pattern: {
		type: String,
		required: true
	},
	category: {
		type: String
	},
	matches: {
		type: Number,
		required: true,
		default: 0
	},
	created: {
		type: Date,
		required: true,
		default: Date.now
	},
	lastMatch: {
		type: Date
	}
});

const blocklistSchema = new mongoose.Schema({
	userId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: userModelName,
		required: true,
		index: true,
		unique: true
	},
	patterns: {
		type: [String],
		required: true
	}
});

const downloadSchema = new mongoose.Schema({
	userId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: userModelName,
		required: true,
		index: true
	},
	time: {
		type: Date,
		required: true,
		default: Date.now
	},
	name: {
		type: String,
		required: true
	},
	size: {
		type: Number
	},
	manual: {
		type: Boolean,
		required: true
	}
});

export class Database {
	connection: mongoose.Connection;

	user: mongoose.Model<User>;
	session: mongoose.Model<Session>;
	subscription: mongoose.Model<Subscription>;
	blocklists: mongoose.Model<Blocklist>;
	download: mongoose.Model<Download>;

	async connect(uri: string) {
		const options: mongoose.ConnectionOptions = {
			useNewUrlParser: true,
			useFindAndModify: true,
			useCreateIndex: true,
			useUnifiedTopology: true
		};
		this.connection = await mongoose.createConnection(uri, options);
		this.initializeModels();
	}

	close() {
		if (this.connection != null) {
			this.connection.close();
			this.connection = null;
		}
	}

	initializeModels() {
		this.user = this.connection.model<User>(userModelName, userSchema);
		this.session = this.connection.model<Session>(sessionModelName, sessionSchema);
		this.subscription = this.connection.model<Subscription>(subscriptionModelName, subscriptionSchema);
		this.blocklists = this.connection.model<Blocklist>(blocklistModelName, blocklistSchema);
		this.download = this.connection.model<Download>(downloadModelName, downloadSchema);
	}

	newUser(name: string, salt: Buffer, password: Buffer, isAdmin: boolean): User {
		return new this.user({
			name: name,
			salt: salt,
			password: password,
			isAdmin: isAdmin
		});
	}

	newSession(userId: mongoose.Types.ObjectId, sessionId: Buffer, address: string, userAgent: string): Session {
		const created = new Date();
		const lastAccess = created;
		return new this.session({
			userId: userId,
			sessionId: sessionId,
			address: address,
			userAgent: userAgent,
			created: created,
			lastAccess: lastAccess
		});
	}

	newSubscription(userId: mongoose.Types.ObjectId, pattern: string, category: string): Subscription {
		return new this.subscription({
			userId: userId,
			pattern: pattern,
			category: category
		});
	}

	newBlocklist(userId: mongoose.Types.ObjectId, patterns: string[]): Blocklist {
		return new this.blocklists({
			userId: userId,
			patterns: patterns
		});
	}

	newDownload(userId: mongoose.Types.ObjectId, name: string, size: number, manual: boolean) {
		return new this.download({
			userId: userId,
			name: name,
			size: size,
			manual: manual
		});
	}
}