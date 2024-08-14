import type { Database, Thread, ThreadMessage } from '../types/database.js';

export type CreateThreadArgs = {
  db: Database;
  chatId: number;
  threadId: number;
  messages?: ThreadMessage[];
  create?: boolean;
};

export async function createThread(args: CreateThreadArgs): Promise<Thread> {
  const { db, chatId, threadId, messages = [] } = args;

  const thread: Thread = { chatId, threadId, messages };
  await db.thread.insertOne({ chatId, threadId, messages });

  return thread;
}

export async function getThread(args: CreateThreadArgs): Promise<Thread | null> {
  const { db, chatId, threadId } = args;
  return db.thread.findOne({ chatId, threadId });
}

export type UpdateThreadArgs = CreateThreadArgs & {
  messages: ThreadMessage[];
};

export async function updateThread(args: UpdateThreadArgs): Promise<void> {
  const { db, chatId, threadId, messages } = args;

  await db.thread.updateOne(
    { chatId, threadId }, //
    { $push: { messages: { $each: messages } } },
  );
}
