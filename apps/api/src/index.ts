import "./env.js";
import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { startEmailWorker } from "./lib/email.js";

const port = Number(process.env.PORT) || 8787;

serve({ fetch: app.fetch, port });
startEmailWorker();
console.log(`API listening on http://localhost:${port}`);
