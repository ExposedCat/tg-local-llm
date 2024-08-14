import type { DefaultContext } from '../types/context.js';

export function createReplyWithTextFunc(ctx: DefaultContext): DefaultContext['text'] {
  return (resourceKey, templateData, extra = {}) => {
    extra.parse_mode = 'HTML';
    extra.link_preview_options = {
      is_disabled: true,
    };
    const text = ctx.t(resourceKey, templateData);
    return ctx.reply(text, extra);
  };
}
