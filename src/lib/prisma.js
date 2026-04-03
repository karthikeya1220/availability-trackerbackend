import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import dns from "dns";

// DNS Shim: Bypass system DNS block of *.neon.tech
const NEON_HOST = "ep-damp-frost-a4i8gsng.us-east-1.aws.neon.tech";
const NEON_IP = "35.171.11.169";

const originalLookup = dns.lookup;
dns.lookup = (hostname, options, callback) => {
  if (hostname === NEON_HOST) {
    const cb = typeof options === "function" ? options : callback;
    const opts = typeof options === "object" ? options : {};
    if (opts.all) {
      return cb(null, [{ address: NEON_IP, family: 4 }], 4);
    }
    return cb(null, NEON_IP, 4);
  }
  return originalLookup(hostname, options, callback);
};

// Configure Neon for WebSocket support (port 443)
neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({ connectionString });
const adapter = new PrismaNeon(pool);

export const prisma = new PrismaClient({ adapter });
