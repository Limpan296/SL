// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";

// server/storage.ts
var MemStorage = class {
  items;
  currentId;
  constructor() {
    this.items = /* @__PURE__ */ new Map();
    this.currentId = 1;
  }
  async getItems() {
    return Array.from(this.items.values());
  }
  async createItem(insertItem) {
    const id = this.currentId++;
    const item = {
      ...insertItem,
      id,
      completed: insertItem.completed ?? false
    };
    this.items.set(id, item);
    return item;
  }
  async updateItem(id, data) {
    const item = this.items.get(id);
    if (!item) {
      throw new Error("Item not found");
    }
    const updatedItem = {
      ...item,
      ...data.completed !== void 0 && { completed: data.completed },
      ...data.category !== void 0 && { category: data.category },
      ...data.name !== void 0 && { name: data.name }
    };
    this.items.set(id, updatedItem);
    return updatedItem;
  }
  async deleteItem(id) {
    if (!this.items.has(id)) {
      throw new Error("Item not found");
    }
    this.items.delete(id);
  }
  async deleteAllItems() {
    this.items.clear();
  }
};
var storage = new MemStorage();

// shared/schema.ts
import { pgTable, text, serial, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var items = pgTable("items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  completed: boolean("completed").notNull().default(false)
});
var insertItemSchema = createInsertSchema(items).pick({
  name: true,
  category: true,
  completed: true
});

// server/routes.ts
import { z } from "zod";
var clients = /* @__PURE__ */ new Set();
function broadcastUpdate() {
  storage.getItems().then((items2) => {
    const message = JSON.stringify({ type: "UPDATE", items: items2 });
    Array.from(clients).forEach((client) => {
      try {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      } catch (error) {
        console.error("WebSocket send error:", error);
        clients.delete(client);
      }
    });
  }).catch((error) => {
    console.error("Broadcast error:", error);
  });
}
var updateItemSchema = z.object({
  completed: z.boolean().optional(),
  category: z.string().optional(),
  name: z.string().optional()
});
function registerRoutes(app2) {
  const httpServer = createServer(app2);
  const wss = new WebSocketServer({
    server: httpServer,
    path: "/ws",
    clientTracking: true
  });
  wss.on("connection", (ws) => {
    console.log("New WebSocket connection established");
    clients.add(ws);
    try {
      broadcastUpdate();
    } catch (err) {
      console.error("Initial broadcast error:", err instanceof Error ? err.message : String(err));
    }
    ws.on("error", (err) => {
      console.error("WebSocket error:", err instanceof Error ? err.message : String(err));
      clients.delete(ws);
    });
    ws.on("close", () => {
      console.log("WebSocket connection closed");
      clients.delete(ws);
    });
  });
  app2.get("/api/items", async (_req, res) => {
    try {
      const items2 = await storage.getItems();
      res.json(items2);
    } catch (err) {
      console.error("Get items error:", err instanceof Error ? err.message : String(err));
      res.status(500).json({ message: "Failed to fetch items" });
    }
  });
  app2.post("/api/items", async (req, res) => {
    const result = insertItemSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Invalid item data" });
    }
    try {
      const item = await storage.createItem(result.data);
      broadcastUpdate();
      res.json(item);
    } catch (err) {
      console.error("Create item error:", err instanceof Error ? err.message : String(err));
      res.status(500).json({ message: "Failed to create item" });
    }
  });
  app2.patch("/api/items/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }
    const result = updateItemSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Invalid update data" });
    }
    try {
      const item = await storage.updateItem(id, result.data);
      broadcastUpdate();
      res.json(item);
    } catch (err) {
      console.error("Update item error:", err instanceof Error ? err.message : String(err));
      if (err instanceof Error && err.message === "Item not found") {
        res.status(404).json({ message: "Item not found" });
      } else {
        res.status(500).json({ message: "Failed to update item" });
      }
    }
  });
  app2.delete("/api/items/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }
    try {
      await storage.deleteItem(id);
      broadcastUpdate();
      res.status(204).end();
    } catch (err) {
      console.error("Delete item error:", err instanceof Error ? err.message : String(err));
      if (err instanceof Error && err.message === "Item not found") {
        res.status(404).json({ message: "Item not found" });
      } else {
        res.status(500).json({ message: "Failed to delete item" });
      }
    }
  });
  app2.delete("/api/items", async (_req, res) => {
    try {
      await storage.deleteAllItems();
      broadcastUpdate();
      res.status(204).end();
    } catch (err) {
      console.error("Delete all items error:", err instanceof Error ? err.message : String(err));
      res.status(500).json({ message: "Failed to delete all items" });
    }
  });
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2, { dirname as dirname2 } from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
var vite_config_default = defineConfig({
  plugins: [react(), runtimeErrorOverlay(), themePlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared")
    }
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = dirname2(__filename2);
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        __dirname2,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(__dirname2, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});
app.use((req, res, next) => {
  const start = Date.now();
  log(`Incoming ${req.method} request to ${req.path}`);
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
    if (capturedJsonResponse) {
      logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
    }
    log(logLine);
  });
  next();
});
(async () => {
  try {
    const server = registerRoutes(app);
    app.use((err, _req, res, _next) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      log(`Error: ${message}`);
      log(err.stack);
      res.status(status).json({ message });
    });
    log(`Current NODE_ENV: ${process.env.NODE_ENV}`);
    log(`Current PORT: ${process.env.PORT || "5000"}`);
    if (process.env.NODE_ENV === "production") {
      log("Setting up static file serving for production");
      serveStatic(app);
    } else {
      log("Setting up Vite for development");
      await setupVite(app, server);
    }
    const port = 5e3;
    const host = "0.0.0.0";
    app.get("*", (req, res, next) => {
      log(`Catch-all route: ${req.path}`);
      if (process.env.NODE_ENV === "production") {
        log("Serving index.html from production build");
        res.sendFile("index.html", { root: "./dist/public" });
      } else {
        log("Passing request to Vite development server");
        next();
      }
    });
    server.listen(port, host, () => {
      log(`Server running at http://${host}:${port}`);
      log(`Environment: ${process.env.NODE_ENV || "development"}`);
      log("Server is now accessible from external devices");
    });
  } catch (error) {
    log(`Fatal error during server startup: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error) {
      log(error.stack || "No stack trace available");
    }
    process.exit(1);
  }
})();
