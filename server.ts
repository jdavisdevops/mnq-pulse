/**
 * Vercel Express entry. Vercel looks for server.{ts,js} at root and uses the default export.
 * Local dev still runs via server/index.ts (npm run dev).
 */
import { getApp } from "./server/index";

export default await getApp();
