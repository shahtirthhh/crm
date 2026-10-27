// Imported first by scripts so .env.local / .env are loaded before any module reads them.
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });
