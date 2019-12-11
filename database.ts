import mongoose from 'mongoose';

export interface User extends mongoose.Document {
	name: string;
	password: Buffer;
	isAdmin: boolean;
	created: Date;
	lastLogin: Date;
}

export class Database {
	connection: mongoose.Connection;

	user: mongoose.Model<User>;

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
		this.user = this.connection.model<User>("user", new mongoose.Schema({
			name: {
				type: String,
				required: true,
				index: true
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
				type: Date,
				required: true
			}
		}));
	}
}