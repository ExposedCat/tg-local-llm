import type { Collection } from 'mongodb';

export type ThreadMessage = {
  role: 'user' | 'assistant';
  fromId: number | null;
  content: string;
  images?: string[];
};

export type Thread = {
  chatId: number;
  threadId: number;
  messages: ThreadMessage[];
};

export type Database = {
  thread: Collection<Thread>;
};
