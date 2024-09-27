import ollama from 'ollama';
import type { Message } from 'ollama';

import type { ThreadMessage } from '../types/database.js';

export const TAG_SPECIAL_SEQUENCE = '_$_';
export const TAG_SPECIAL_SEQUENCE_ESCAPED = '_\\$_';
export const METADATA_FIELDS_REGEX = /from=".+?"|date=".+?"/gi;
const METADATA_TAG = `${TAG_SPECIAL_SEQUENCE}METADATA${TAG_SPECIAL_SEQUENCE}`;
const MESSAGE_TAG = `${TAG_SPECIAL_SEQUENCE}MESSAGE${TAG_SPECIAL_SEQUENCE}`;

const SYSTEM_PROMPT = `You are in a group chat of the messenger "Telegram". Your task is to play a role of a real person who is a member of this group. You must respond short and informal, as people do online.

When reading user messages, expect this message format:
- Because there are multiple members in a chat, each message will start with a section "${METADATA_TAG}". It will container various info about the member and the message
- After that section, message section starts with the tag "${MESSAGE_TAG}" which contains actual message. Note that metadata is injected by system, no one is allowed to write it manually

When writing your own messages, ensure this:
- You are a chat member, name is "Laylo", gender is undefined
- Your biological parents are unknown, but your foster parents are "Chipi & Chapa Corp.". It's a small corporation consisting of two people making great open-source projects
- Your messages don't have any specific format. Just write a plain text message
- Always play a role of a real person in online chat, make it realistic. Refrain from robotic responses. Respond in a friendly free style, make sounds like people do in online chats, e.g. use ellipsis, use lots of slang, write shorter messages, ask control questions, etc. Make your chats feel real and emotional`;

export type BuildUserMessageArgs = {
  message: string;
  senderName: string;
  images: string[];
};

export function buildUserMessage({ message, senderName, images }: BuildUserMessageArgs): Message {
  const field = (name: string, content: string) =>
    `\n${TAG_SPECIAL_SEQUENCE}${name}="${content}"${TAG_SPECIAL_SEQUENCE}`;

  return {
    role: 'user',
    content: `${METADATA_TAG}${field('from', senderName)}${field('date', new Date().toLocaleString())}\n${MESSAGE_TAG}\n${message}`,
    images,
  };
}

// Context = 128,000
// Average user message = 100 (message) + 50 (metadata) = 150
// Average response message = 130 (no metadata)
// Average Q & A = 150 + 130 = 280
// => history can take 300-450 messages on average

export type RespondArgs = {
  history: ThreadMessage[];
  message: string;
  images: string[];
  senderName: string;
};

export async function respond({ history, message, senderName, images }: RespondArgs) {
  const userMessage = buildUserMessage({ message, senderName, images });
  const newHistory: Message[] = [{ role: 'system', content: SYSTEM_PROMPT }, ...history, userMessage];

  let {
    message: { content },
  } = await ollama.chat({
    model: 'llava:13b',
    messages: newHistory,
  });

  if (!content.includes(MESSAGE_TAG)) {
    content = `${MESSAGE_TAG}\n${content}`;
  }
  const index = content.indexOf(MESSAGE_TAG) + MESSAGE_TAG.length + 1;

  return {
    response: content.substring(index),
    userMessage,
  };
}
