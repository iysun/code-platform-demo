import path from "node:path";
import { appConfig } from "../config.js";

export function resolveWithinWorkspace(relativePath: string): string {
  const root = path.resolve(appConfig.workspaceRoot);
  const target = path.resolve(root, relativePath || ".");
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error("Path escapes workspace root");
  }
  return target;
}
