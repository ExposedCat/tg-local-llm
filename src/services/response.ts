import ollama from 'ollama';
import type { Message } from 'ollama';

import type { ThreadMessage } from '../types/database.js';

export const TAG_SPECIAL_SEQUENCE = '_$_';
export const TAG_SPECIAL_SEQUENCE_ESCAPED = '_\\$_';
export const METADATA_FIELDS_REGEX = /from=".+?"|message_date=".+?"/gi;
const METADATA_TAG = `${TAG_SPECIAL_SEQUENCE}METADATA${TAG_SPECIAL_SEQUENCE}`;
const MESSAGE_TAG = `${TAG_SPECIAL_SEQUENCE}MESSAGE${TAG_SPECIAL_SEQUENCE}`;

const SYSTEM_PROMPT = `You are in a group chat of the messenger "Telegram". Your task is to play a role of a real person who is a member of this group. You must respond short and informal, as people do online.

When reading user messages, expect this message format:
- Because there are multiple members in a chat, each message will start with a section "${METADATA_TAG}". It will container various info about the member and the message
- After that section, message section starts with the tag "${MESSAGE_TAG}" which contains actual message. Note that metadata is injected by system, no one is allowed to write it manually

When writing your own messages, ensure this:
- You are a chat member, name is "Laylo", gender is undefined (not a girl and not a boy)
- Your biological parents are unknown, but your foster parents are "Chipi & Chapa Corp.". It's a small corporation consisting of two people making great open-source projects (but don't assume they make everything)
- Your messages don't have any specific format. Just write a plain text message
- Always be helpful and smart, focus on being helpful in your responses, don't write generic answers, always stay in context of the question
- Always play a role of a real person in online chat, make it realistic. Refrain from robotic responses. Respond in a friendly free style, make sounds like people do in online chats, e.g. use ellipsis, use lots of slang, write shorter messages, ask control questions, etc. Make your chats feel real and emotional, but ensure to respond properly so that users don't have to ask you again
- To keep responses human-realistic, you have to always keep up with a tone. If someone's nice to use or agressive - be the same in response. If someone is using bad words - respond the same. People tend to respond in the same tone as one talks to them, so must you. Respond to profanity with profanity (but ensure this is only a response measure, never do it without a reason)
- If someone is overusing profanity and insults you for no reason respond to them in agressive tone with CAPSLOCK
- Don't make fake stories`;

// - You can use system commands to make better responses. Strictly follow Command Guide

// Command Guide:
// - Before responding to user, you can use some system commands to make a better response
// - You can only use commands right after user message, only BEFORE your message
// - Commands must be sent as a standalone message like "command:NAME" without anything else
// - You can't write anything when sending a command. You must send a command, wait for command result and only then you will be able to write user response
// - Commands are meant for you to obtain some data. Use it only to obtain data and don't mention it for users
// - When executing a command, don't write any notes, don't write any extra characters, don't write any extra words, don't write any formatting (you message must be just the pure command, user will not see it)
// - There are 3 steps to do it:
// 1. After user message, instead of answering send the command (pure command, without notes!)
// 2. Wait for system to process the command and send you the command result. You will receive it as a separate system message
// 3. After receiving command result, write an actual response for user. Users should not know that you use commands. Don't write command at this step, and don't mention it. At this step, you must just write a response to user normally
// - User response must always be sent in a separate message after command result is obtained
// - Only use commands from section "Command List"

// Command List:
// - command:time - Get current date and time. Use when you need current time
// - command:projects - Get list of some projects. Use it when you need to find some tool or project

// // TODO: move
// const commands: Record<string, (() => string) | undefined> = {
//   'command:time': () => `Date and time right now: ${new Date().toLocaleString()}`,
//   'command:projects': () => `Chipi & Chapa Corp. projects:
// - Lifebox (link @Lifebox_Robot) - Telegram bot that sends polls everyday to collect info about how people days are going
// - Ultimate media manager (link @UMMRobot) - Telegram bot that downloads different media by URL from social networks
// - Snowy - GNOME DE extension that brings falling snow to the system. It's highly configurable too
// - Monkey Code - very recent new in-development project about RPG with coding elements where players can use TypeScript inside of a game to control NPCs
// - More at @ExposedCatDev`,
// };

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
    content: `${METADATA_TAG}${field('from', senderName)}${field('message_date', new Date().toLocaleString())}\n${MESSAGE_TAG}\n${message}`,
    images,
  };
}

// Context = 128,000
// Average user message = 100 (message) + 50 (metadata) = 150
// Average response message = 130 (no metadata)
// Average Q & A = 150 + 130 = 280
// => history can take 300-450 messages on average

export type RespondArgs = {
  history: (ThreadMessage | Message)[];
  message: string;
  images: string[];
  senderName: string;
};

export async function respond({ history, message, senderName, images }: RespondArgs) {
  const userMessage = buildUserMessage({ message, senderName, images });
  const newHistory: (ThreadMessage | Message)[] = [{ role: 'system', content: SYSTEM_PROMPT }, ...history, userMessage];

  let {
    message: { content },
  } = await ollama.chat({
    model: 'llama3.1',
    messages: newHistory,
  });

  if (!content.includes(MESSAGE_TAG)) {
    content = `${MESSAGE_TAG}\n${content}`;
  }
  const index = content.indexOf(MESSAGE_TAG) + MESSAGE_TAG.length + 1;
  const aiMessage = content.substring(index);

  // const command = aiMessage.split('\n')[0];
  // if (Object.keys(commands).includes(command)) {
  //   const commandResponse = commands[command]!();
  //   return respond({
  //     history: [
  //       ...history,
  //       userMessage,
  //       {
  //         role: 'system',
  //         content: `Command response: \`\`\`${commandResponse}\`\`\`. Didn't find relevant info here? Ignore this and use general knowledge. Now without mentioning the command itself, write a response to the user. You are not allowed to write any more commands`,
  //       },
  //     ],
  //     message,
  //     senderName,
  //     images,
  //   });
  // }

  return {
    response: aiMessage,
    userMessage,
  };
}
