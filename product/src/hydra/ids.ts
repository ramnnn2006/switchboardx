/**
 * HydraDB node ids are non-negative integers (cypher-compat.md). Tool/type/server
 * ids are strings, so we map them with a stable FNV-1a 64-bit hash, masked to
 * 2^53-1 so the value is exact both in JS numbers and in the Bolt integer type.
 * The original string id is always stored on the node (`sid` / `name`).
 */
export function hydraId(key: string): number {
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < key.length; i++) {
    h ^= BigInt(key.charCodeAt(i));
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return Number(h % 9007199254740991n); // 2^53 - 1
}

export const toolKey = (sid: string) => `tool:${sid}`;
export const typeKey = (name: string) => `type:${name}`;
export const serverKey = (sid: string) => `server:${sid}`;
export const pairKey = (prev: string, next: string) => `pair:${prev}->${next}`;
export const heldKey = (account: string, type: string) => `held:${account}:${type}`;
