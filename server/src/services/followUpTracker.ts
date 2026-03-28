import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { env } from '../config/env';

export interface FollowUp {
  id: string;
  description: string;
  dueDate?: string;  // ISO date string
  status: 'pending' | 'completed' | 'dismissed';
  createdAt: string;
}

interface FollowUpStore {
  followUps: FollowUp[];
}

function getStorePath(): string {
  return path.resolve(env.FOLLOW_UP_PATH);
}

function ensureDirectory(filePath: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function loadStore(): FollowUpStore {
  const filePath = getStorePath();
  try {
    if (!fs.existsSync(filePath)) {
      return { followUps: [] };
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.warn('[FollowUp] Failed to load follow-ups:', (error as Error).message);
    return { followUps: [] };
  }
}

function saveStore(store: FollowUpStore): void {
  const filePath = getStorePath();
  ensureDirectory(filePath);
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf-8');
}

/**
 * Load all follow-ups from the JSON file.
 */
export function loadFollowUps(): FollowUp[] {
  return loadStore().followUps;
}

/**
 * Get only pending follow-ups.
 */
export function getPendingFollowUps(): FollowUp[] {
  return loadStore().followUps.filter(f => f.status === 'pending');
}

/**
 * Create a new follow-up reminder.
 */
export function createFollowUp(description: string, dueDate?: string): FollowUp {
  const store = loadStore();
  const followUp: FollowUp = {
    id: crypto.randomUUID(),
    description,
    dueDate,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  store.followUps.push(followUp);
  saveStore(store);
  console.log(`[FollowUp] Created follow-up ${followUp.id}: ${description}`);
  return followUp;
}

/**
 * Mark a follow-up as completed.
 * Returns true if the follow-up was found and updated.
 */
export function completeFollowUp(id: string): boolean {
  const store = loadStore();
  const followUp = store.followUps.find(f => f.id === id);
  if (followUp) {
    followUp.status = 'completed';
    saveStore(store);
    console.log(`[FollowUp] Completed follow-up ${id}`);
    return true;
  }
  return false;
}

/**
 * Mark a follow-up as dismissed.
 * Returns true if the follow-up was found and updated.
 */
export function dismissFollowUp(id: string): boolean {
  const store = loadStore();
  const followUp = store.followUps.find(f => f.id === id);
  if (followUp) {
    followUp.status = 'dismissed';
    saveStore(store);
    console.log(`[FollowUp] Dismissed follow-up ${id}`);
    return true;
  }
  return false;
}

/**
 * Format pending follow-ups as a text block for injection into the system prompt.
 * Returns an empty string if there are no pending follow-ups.
 */
export function getFollowUpSummary(): string {
  const pending = getPendingFollowUps();
  if (pending.length === 0) return '';
  return pending.map(f => {
    const due = f.dueDate ? ` (due: ${f.dueDate})` : '';
    return `- ${f.description}${due}`;
  }).join('\n');
}
