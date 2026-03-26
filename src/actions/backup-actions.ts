"use server";

import fs from "fs";
import path from "path";
import os from "os";

const DB_PATH = path.join(process.cwd(), "prisma", "data", "database.sqlite");
const BACKUP_DIR = path.join(os.homedir(), "AoiroShinkoku", "backups");

export async function createBackup(): Promise<{ name: string; path: string }> {
  if (!fs.existsSync(DB_PATH)) {
    throw new Error("データベースファイルが見つかりません: " + DB_PATH);
  }
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  let destPath = path.join(BACKUP_DIR, `aoiro-${dateStr}.db`);

  // 同日に複数作る場合は連番を付ける
  if (fs.existsSync(destPath)) {
    let i = 2;
    while (fs.existsSync(path.join(BACKUP_DIR, `aoiro-${dateStr}-${i}.db`))) i++;
    destPath = path.join(BACKUP_DIR, `aoiro-${dateStr}-${i}.db`);
  }

  fs.copyFileSync(DB_PATH, destPath);
  return { name: path.basename(destPath), path: destPath };
}

export async function listBackups(): Promise<
  { name: string; path: string; sizeKB: number; createdAt: string }[]
> {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith(".db"))
    .sort()
    .reverse()
    .map((name) => {
      const fullPath = path.join(BACKUP_DIR, name);
      const stat = fs.statSync(fullPath);
      return {
        name,
        path: fullPath,
        sizeKB: Math.round(stat.size / 1024),
        createdAt: stat.mtime.toISOString(),
      };
    });
}

export async function getBackupDir(): Promise<string> {
  return BACKUP_DIR;
}
