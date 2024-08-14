import { Composer } from 'grammy';

import type { CustomContext } from '../types/context.js';

export const startController = new Composer<CustomContext>();
startController.command('start', async ctx => {
  await ctx.text('start', {
    name: ctx.dbEntities.user.name,
    chatName: ctx.dbEntities.chat?.title ?? 'PM',
  });
});
