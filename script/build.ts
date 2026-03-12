import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, mkdir, cp, writeFile } from "fs/promises";
import path from "path";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("embedding SPA HTML for Vercel...");
  await import("./embed-html.ts");

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/server.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  if (process.env.VERCEL) {
    console.log("writing Vercel Build Output API...");
    const out = path.join(process.cwd(), ".vercel", "output");
    const staticDir = path.join(out, "static");
    const funcDir = path.join(out, "functions", "index.func");
    await rm(out, { recursive: true, force: true });
    await mkdir(staticDir, { recursive: true });
    await mkdir(funcDir, { recursive: true });
    await cp(path.join(process.cwd(), "dist", "public"), staticDir, { recursive: true });
    const launcherJs = `const mod = require("./server.cjs");
const appPromise = mod.getApp ? mod.getApp() : Promise.resolve(mod.default != null ? mod.default : mod);
module.exports = async function handler(req, res) {
  const app = await appPromise;
  return app(req, res);
};
`;
    await cp(path.join(process.cwd(), "dist", "server.cjs"), path.join(funcDir, "server.cjs"));
    await writeFile(path.join(funcDir, "index.js"), launcherJs, "utf-8");
    await writeFile(
      path.join(funcDir, ".vc-config.json"),
      JSON.stringify({ runtime: "nodejs20.x", handler: "index.js", launcherType: "Nodejs" }),
      "utf-8"
    );
    // Pass real path as __path so Express can route (e.g. POST /api/settings)
    await writeFile(
      path.join(out, "config.json"),
      JSON.stringify({
        version: 3,
        routes: [
          { src: "/", dest: "/index.html" },
          { handle: "filesystem" },
          { src: "/api/(.*)", dest: "/index?__path=/api/$1" },
        ],
      }),
      "utf-8"
    );
    console.log("Build Output API written to .vercel/output");
  }
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
