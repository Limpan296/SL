import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertItemSchema } from "@shared/schema";
import { z } from "zod";

const clients = new Set<WebSocket>();

function broadcastUpdate() {
  storage.getItems().then(items => {
    const message = JSON.stringify({ type: "UPDATE", items });
    Array.from(clients).forEach(client => {
      try {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      } catch (error) {
        console.error('WebSocket send error:', error);
        clients.delete(client);
      }
    });
  }).catch(error => {
    console.error('Broadcast error:', error);
  });
}

const updateItemSchema = z.object({
  completed: z.boolean().optional(),
  category: z.string().optional(),
  name: z.string().optional(),
});

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  // Setup WebSocket server with error handling
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws',
    clientTracking: true
  });

  wss.on('connection', (ws) => {
    console.log('New WebSocket connection established');
    clients.add(ws);

    try {
      broadcastUpdate();
    } catch (err) {
      console.error('Initial broadcast error:', err instanceof Error ? err.message : String(err));
    }

    ws.on('error', (err) => {
      console.error('WebSocket error:', err instanceof Error ? err.message : String(err));
      clients.delete(ws);
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed');
      clients.delete(ws);
    });
  });

  // REST endpoints
  app.get("/api/items", async (_req, res) => {
    try {
      const items = await storage.getItems();
      res.json(items);
    } catch (err) {
      console.error('Get items error:', err instanceof Error ? err.message : String(err));
      res.status(500).json({ message: "Failed to fetch items" });
    }
  });

  app.post("/api/items", async (req, res) => {
    const result = insertItemSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Invalid item data" });
    }
    try {
      const item = await storage.createItem(result.data);
      broadcastUpdate();
      res.json(item);
    } catch (err) {
      console.error('Create item error:', err instanceof Error ? err.message : String(err));
      res.status(500).json({ message: "Failed to create item" });
    }
  });

  app.patch("/api/items/:id", async (req, res) => {
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
      console.error('Update item error:', err instanceof Error ? err.message : String(err));
      if (err instanceof Error && err.message === "Item not found") {
        res.status(404).json({ message: "Item not found" });
      } else {
        res.status(500).json({ message: "Failed to update item" });
      }
    }
  });

  app.delete("/api/items/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    try {
      await storage.deleteItem(id);
      broadcastUpdate();
      res.status(204).end();
    } catch (err) {
      console.error('Delete item error:', err instanceof Error ? err.message : String(err));
      if (err instanceof Error && err.message === "Item not found") {
        res.status(404).json({ message: "Item not found" });
      } else {
        res.status(500).json({ message: "Failed to delete item" });
      }
    }
  });

  app.delete("/api/items", async (_req, res) => {
    try {
      await storage.deleteAllItems();
      broadcastUpdate();
      res.status(204).end();
    } catch (err) {
      console.error('Delete all items error:', err instanceof Error ? err.message : String(err));
      res.status(500).json({ message: "Failed to delete all items" });
    }
  });

  return httpServer;
}