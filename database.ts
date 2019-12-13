import mongoose from 'mongoose';

export interface User extends mongoose.Document {
	name: string;
	salt: Buffer;
	password: Buffer;
	isAdmin: boolean;
	created: Date;
	lastLogin: Date;
}

const userSchema = new mongoose.Schema({
	name: {
		type: String,
		required: true,
		index: true
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
		required: true
	},
	lastLogin: {
		type: Date
	}
});

export interface Session extends mongoose.Document {
	userId: number;
	sessionId: Buffer;
	address: string;
	userAgent: string;
	created: Date;
	lastAccess: Date;
}

const sessionSchema = new mongoose.Schema({
	userId: {
		type: Number,
		required: true
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
		type: String,
		required: true
	},
	created: {
		type: Date,
		required: true
	},
	lastAccess: {
		type: Date,
		required: true
	}
});
sessionSchema.index({ userId: 1, sessionId: 1 }, { unique: true });

export interface Subscription extends mongoose.Document {
	userId: number;
	pattern: string;
	category: string;
	matches: number;
	created: Date;
	lastMatch: Date;
}

const subscriptionSchema = new mongoose.Schema({
	userId: {
		type: Number,
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
		required: true
	},
	created: {
		type: Date,
		required: true
	},
	lastMatch: {
		type: Date
	}
});

export interface Download extends mongoose.Document {
	userId: number;
	time: Date;
	name: string;
	size: number;
	manual: boolean;
}

const downloadSchema = new mongoose.Schema({
	userId: {
		type: Number,
		required: true,
		index: true
	},
	time: {
		type: Date,
		required: true
	},
	name: {
		type: String,
		required: true
	},
	size: {
		type: Number,
		required: true
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
		this.user = this.connection.model<User>("user", userSchema);
		this.session = this.connection.model<Session>("session", sessionSchema);
		this.subscription = this.connection.model<Subscription>("subscription", subscriptionSchema);
		this.download = this.connection.model<Download>("download", downloadSchema);
	}
}