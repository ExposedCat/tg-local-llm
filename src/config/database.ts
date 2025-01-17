import { MongoClient } from "mongodb";

import type { Database, Thread } from "../types/database.js";

export async function connectToDb() {
	const client = new MongoClient(process.env.DB_CONNECTION_STRING);
	await client.connect();
	const mongoDb = client.db();
	const thread = mongoDb.collection<Thread>("thread");
	const database: Database = { thread };
	return database;
}
