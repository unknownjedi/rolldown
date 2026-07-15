import fs from 'node:fs/promises';
import type { BindingPluginOptions } from '../binding.cjs';
import { normalizeHook } from '../utils/normalize-hook';
import type { BindingifyPluginArgs } from './bindingify-plugin';
import {
  bindingifyPluginHookMeta,
  type PluginHookWithBindingExt,
} from './bindingify-plugin-hook-meta';
import type { ChangeEvent } from './index';
import { PluginContextImpl } from './plugin-context';

// Ported from vite's `readModifiedFile` (vitejs/vite#610): editors may save by
// truncating the file and then writing, and the watcher fires on the truncate —
// an immediate read can land in the gap and see an empty buffer. On an empty
// read, wait for the mtime to move (the second write) before reading again.
async function readModifiedFile(file: string): Promise<string> {
  const content = await fs.readFile(file, 'utf-8');
  if (!content) {
    const mtime = (await fs.stat(file)).mtimeMs;
    for (let n = 0; n < 10; n++) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 10);
      });
      const newMtime = (await fs.stat(file)).mtimeMs;
      if (newMtime !== mtime) {
        break;
      }
    }
    return fs.readFile(file, 'utf-8');
  }
  return content;
}

export function bindingifyHotUpdate(
  args: BindingifyPluginArgs,
): PluginHookWithBindingExt<BindingPluginOptions['hotUpdate']> {
  const hook = args.plugin.hotUpdate;
  if (!hook) {
    return {};
  }
  const { handler, meta } = normalizeHook(hook);

  return {
    plugin: async (ctx, hookArgs) => {
      const result = await handler.call(
        new PluginContextImpl(
          args.outputOptions,
          ctx,
          args.plugin,
          args.pluginContextData,
          args.onLog,
          args.logLevel,
          args.watchMode,
        ),
        {
          type: hookArgs.kind as ChangeEvent,
          file: hookArgs.file,
          modules: hookArgs.modules,
          read: () => readModifiedFile(hookArgs.file),
        },
      );
      return result ?? undefined;
    },
    meta: bindingifyPluginHookMeta(meta),
  };
}

export function bindingifyWatchChange(
  args: BindingifyPluginArgs,
): PluginHookWithBindingExt<BindingPluginOptions['watchChange']> {
  const hook = args.plugin.watchChange;
  if (!hook) {
    return {};
  }
  const { handler, meta } = normalizeHook(hook);

  return {
    plugin: async (ctx, id, event) => {
      await handler.call(
        new PluginContextImpl(
          args.outputOptions,
          ctx,
          args.plugin,
          args.pluginContextData,
          args.onLog,
          args.logLevel,
          args.watchMode,
        ),
        id,
        { event: event as ChangeEvent },
      );
    },
    meta: bindingifyPluginHookMeta(meta),
  };
}

export function bindingifyCloseWatcher(
  args: BindingifyPluginArgs,
): PluginHookWithBindingExt<BindingPluginOptions['closeWatcher']> {
  const hook = args.plugin.closeWatcher;
  if (!hook) {
    return {};
  }
  const { handler, meta } = normalizeHook(hook);

  return {
    plugin: async (ctx) => {
      await handler.call(
        new PluginContextImpl(
          args.outputOptions,
          ctx,
          args.plugin,
          args.pluginContextData,
          args.onLog,
          args.logLevel,
          args.watchMode,
        ),
      );
    },
    meta: bindingifyPluginHookMeta(meta),
  };
}
