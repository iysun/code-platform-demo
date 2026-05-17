import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { appConfig } from "../config.js";
import * as schema from "./schema.js";

mkdirSync(path.dirname(appConfig.databasePath), { recursive: true });

const url = `file:${appConfig.databasePath}`;
export const libsqlClient = createClient({ url });
export const db = drizzle(libsqlClient, { schema });
