import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

// Load environmental parameters
dotenv.config();

const cleanEnvVar = (val: string): string => {
  if (!val) return '';
  let cleaned = val.trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1);
  }
  return cleaned.trim();
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Serve API config endpoint
  app.get('/api/config', (req, res) => {
    // Read secure variables from backend env safely
    const rawUrl = process.env.VITE_SUPABASE_URL || '';
    const rawKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEy || '';
    
    // Default fallback configurations
    const DEFAULT_URL = 'https://mranisjoydkfmsowuzms.supabase.co';
    const DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yYW5pc2pveWRrZm1zb3d1em1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTU4ODYsImV4cCI6MjA5NDk5MTg4Nn0.ZOY6FH2JMd6vz5w76QanqQxuWIL0VcLNKLvU2xuinZQ';

    const cleanUrl = cleanEnvVar(rawUrl);
    const cleanKey = cleanEnvVar(rawKey);

    res.json({
      supabaseUrl: cleanUrl || DEFAULT_URL,
      supabaseAnonKey: cleanKey || DEFAULT_KEY
    });
  });

  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Dev Server] Mounting active Vite middleware...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    console.log('[Prod Server] Serving built files statically...');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Host Server] Express server online: http://0.0.0.0:${PORT}`);
  });
}

startServer();
