import { MongoClient } from "mongodb";

import type { Chat, Database, Thread } from "../types/database.js";

export async function connectToDb() {
	const client = new MongoClient(process.env.DB_CONNECTION_STRING);
	await client.connect();
	const mongoDb = client.db();
	const thread = mongoDb.collection<Thread>("thread");
	const chat = mongoDb.collection<Chat>("chat");
	const database: Database = { thread, chat };
	return database;
}
