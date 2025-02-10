import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add CORS headers for mobile access
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Add logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  log(`Incoming ${req.method} request to ${req.path}`);

  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
    if (capturedJsonResponse) {
      logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
    }
    log(logLine);
  });

  next();
});

(async () => {
  try {
    // Create HTTP server before setting up routes
    const server = registerRoutes(app);

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      log(`Error: ${message}`);
      log(err.stack); // Log the full stack trace
      res.status(status).json({ message });
    });

    // Log environment information
    log(`Current NODE_ENV: ${process.env.NODE_ENV}`);
    log(`Current PORT: ${process.env.PORT || '5000'}`);

    // Setup Vite or serve static files based on environment
    if (process.env.NODE_ENV === "production") {
      log("Setting up static file serving for production");
      serveStatic(app);
    } else {
      log("Setting up Vite for development");
      await setupVite(app, server);
    }

    // Use port 5000 for the server to match Replit's configuration
    const port = 5000;
    const host = '0.0.0.0';

    // Add catch-all route for client-side routing
    app.get('*', (req, res, next) => {
      log(`Catch-all route: ${req.path}`);
      if (process.env.NODE_ENV === "production") {
        log('Serving index.html from production build');
        res.sendFile('index.html', { root: './dist/public' });
      } else {
        log('Passing request to Vite development server');
        next();
      }
    });

    server.listen(port, host, () => {
      log(`Server running at http://${host}:${port}`);
      log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      log('Server is now accessible from external devices');
    });
  } catch (error) {
    log(`Fatal error during server startup: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error) {
      log(error.stack || 'No stack trace available');
    }
    process.exit(1);
  }
})();