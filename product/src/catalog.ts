import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { encodingForModel } from 'js-tiktoken';
import type { Catalog, ToolNode } from './types.js';

const enc = encodingForModel('gpt-4'); // cl100k_base

export function countTokens(text: string): number {
  return enc.encode(text).length;
}

export function schemaTokens(schema: unknown): number {
  return countTokens(JSON.stringify(schema ?? {}));
}

export function loadCatalog(path?: string): Catalog {
  const p = path ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'catalog.starter.json');
  const cat = JSON.parse(readFileSync(resolve(p), 'utf8')) as Catalog;
  for (const t of cat.tools) {
    if (!t.schemaTokens) t.schemaTokens = t.schema ? schemaTokens(t.schema) : estimateTokens(t);
  }
  return cat;
}

/** rough cl100k estimate for tools that ship without a stored schema */
function estimateTokens(t: ToolNode): number {
  return schemaTokens({ name: t.name, description: t.description, inputSchema: { properties: Object.fromEntries(t.consumes.map((c) => [c.param, { type: 'string' }])) } });
}

export function mergeCatalogs(base: Catalog, extra: Catalog): Catalog {
  const seen = new Map(base.tools.map((t) => [t.id, t]));
  for (const t of extra.tools) seen.set(t.id, t);
  const servers = new Map([...base.servers, ...extra.servers].map((s) => [s.id, s]));
  const types = new Set([...base.types, ...extra.types]);
  return { servers: [...servers.values()], types: [...types], tools: [...seen.values()] };
}

export function toolIndex(cat: Catalog): Map<string, ToolNode> {
  return new Map(cat.tools.map((t) => [t.id, t]));
}

export const dotted = (id: string) => id.replace('/', '.');
export const slashed = (id: string) => (id.includes('/') ? id : id.replace('.', '/'));
