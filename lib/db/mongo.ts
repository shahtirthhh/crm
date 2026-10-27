import "server-only";

import { MongoClient, type Db } from "mongodb";
import { attachDatabasePool } from "@vercel/functions";

const DEFAULT_URI = "mongodb://127.0.0.1:27017/dk_crm";

const globalForMongo = globalThis as unknown as { __mongoClient?: MongoClient };

function createClient(): MongoClient {
  const uri = process.env.MONGODB_URI ?? DEFAULT_URI;
  if (!process.env.MONGODB_URI && process.env.VERCEL) {
    throw new Error("MONGODB_URI is not set");
  }
  const client = new MongoClient(uri, {
    appName: "dk-projects-crm",
    // Optional fields left undefined are omitted rather than stored as null.
    ignoreUndefined: true,
    maxPoolSize: 10,
    maxIdleTimeMS: 5_000,
  });
  // Lets Vercel Fluid compute close idle connections before a function instance is suspended.
  attachDatabasePool(client);
  return client;
}

// One client per process. In development the module is re-evaluated on every change,
// so the client is kept on globalThis to avoid leaking connection pools.
export const mongoClient: MongoClient = globalForMongo.__mongoClient ?? createClient();
if (process.env.NODE_ENV !== "production") globalForMongo.__mongoClient = mongoClient;

/** The database named in MONGODB_URI (or MONGODB_DB). The driver connects lazily on first use. */
export function getDb(): Db {
  return mongoClient.db(process.env.MONGODB_DB || undefined);
}
