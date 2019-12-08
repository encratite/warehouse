import * as mongoose from 'mongoose';

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

    constructor(connection: mongoose.Connection) {
        this.connection = connection;
        this.initializeModels();
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