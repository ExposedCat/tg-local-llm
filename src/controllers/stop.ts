import { Composer } from 'grammy';

import type { DefaultContext } from '../types/context.js';

export const stopController = new Composer<DefaultContext>();
stopController.command('stop', async ctx => {
  await ctx.text('stop');
});
