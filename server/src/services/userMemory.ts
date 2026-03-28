import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { env } from '../config/env';

export interface Memory {
  id: string;
  category: 'preference' | 'fact' | 'reminder';
  content: string;
  createdAt: string;
}

interface MemoryStore {
  memories: Memory[];
}

function getMemoryFilePath(): string {
  return path.resolve(env.USER_MEMORY_PATH);
}

function ensureDirectory(filePath: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Load all memories from the JSON file.
 * Returns an empty array if the file doesn't exist.
 */
export function loadMemories(): Memory[] {
  const filePath = getMemoryFilePath();
  try {
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const store: MemoryStore = JSON.parse(raw);
    return store.memories || [];
  } catch (error) {
    console.warn('[UserMemory] Failed to load memories:', (error as Error).message);
    return [];
  }
}

/**
 * Save a new memory to the JSON file.
 * Creates the data directory and file if they don't exist.
 */
export function saveMemory(category: Memory['category'], content: string): Memory {
  const filePath = getMemoryFilePath();
  ensureDirectory(filePath);

  const memories = loadMemories();
  const memory: Memory = {
    id: crypto.randomUUID(),
    category,
    content,
    createdAt: new Date().toISOString(),
  };
  memories.push(memory);

  const store: MemoryStore = { memories };
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf-8');
  console.log(`[UserMemory] Saved memory ${memory.id}: [${category}] ${content}`);
  return memory;
}

/**
 * Delete a memory by its ID.
 * Returns true if the memory was found and deleted.
 */
export function deleteMemory(id: string): boolean {
  const filePath = getMemoryFilePath();
  const memories = loadMemories();
  const index = memories.findIndex(m => m.id === id);
  if (index === -1) {
    return false;
  }
  memories.splice(index, 1);

  const store: MemoryStore = { memories };
  ensureDirectory(filePath);
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf-8');
  console.log(`[UserMemory] Deleted memory ${id}`);
  return true;
}

/**
 * Format all memories as a text block for injection into the system prompt.
 * Returns an empty string if there are no memories.
 */
export function getMemorySummary(): string {
  const memories = loadMemories();
  if (memories.length === 0) {
    return '';
  }

  const lines = memories.map(m => `- [${m.category}] ${m.content} (id: ${m.id})`);
  return lines.join('\n');
}
