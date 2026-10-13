// Share a configuration as a link: #c=<deflate-raw + base64url of { c: config, a: assets }>. No backend.
// Assets (icon path -> https url) travel along, otherwise the recipient's tech-stack icons would not load.
import type { Raw } from "../core";

const toB64u = (b: Uint8Array) => {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

export type Shared = { c: Raw; a: Record<string, { url: string }> };

export async function encodeShare(payload: Shared): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return toB64u(await pipe(bytes, new CompressionStream("deflate-raw")));
}

export async function decodeShare(token: string): Promise<Shared> {
  const bytes = await pipe(fromB64u(token), new DecompressionStream("deflate-raw"));
  const j = JSON.parse(new TextDecoder().decode(bytes));
  if (!j || typeof j.c !== "object") throw new Error("This link does not contain a configuration.");
  return { c: j.c, a: j.a && typeof j.a === "object" ? j.a : {} };
}
