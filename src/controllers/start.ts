import { Composer } from 'grammy';

import type { DefaultContext } from '../types/context.js';

export const startController = new Composer<DefaultContext>();
startController.command('start', async ctx => {
  await ctx.text('start');
});
