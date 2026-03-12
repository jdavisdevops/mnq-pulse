import express, { type Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

// Promise for Vercel entry (server.ts) to get the app after routes are registered
let appPromiseResolve!: (value: typeof app) => void;
export const appPromise = new Promise<typeof app>((resolve) => {
  appPromiseResolve = resolve;
});

/** Returns the Express app once routes are registered. Used by Vercel serverless entry. */
export function getApp(): Promise<typeof app> {
  return appPromise;
}

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  appPromiseResolve(app);

  // On Vercel: serve SPA and static from public/ (no listen); prevents "download file" when GET /
  if (process.env.VERCEL) {
    const publicDir = path.join(process.cwd(), "public");
    const indexPath = path.join(publicDir, "index.html");
    app.use(express.static(publicDir));
    app.get("*", (_req, res) => {
      res.set("Content-Type", "text/html; charset=utf-8");
      res.set("Content-Disposition", "inline");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(500).send("<!DOCTYPE html><html><body><p>SPA not found. Check build output.</p></body></html>");
      }
    });
    return;
  }

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
