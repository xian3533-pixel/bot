import { writeFile, readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

interface BotSettings {
  channels: {
    media?: string;
    meme?: string;
    announcements?: string;
    rules?: string;
  };
  memeSpam: {
    active: boolean;
    intervalMinutes: number;
  };
}

const SETTINGS_FILE = path.join(process.cwd(), "bot-settings.json");

let settings: BotSettings = {
  channels: {},
  memeSpam: {
    active: false,
    intervalMinutes: 30,
  },
};

export async function loadSettings(): Promise<void> {
  try {
    if (existsSync(SETTINGS_FILE)) {
      const data = await readFile(SETTINGS_FILE, "utf-8");
      settings = JSON.parse(data) as BotSettings;
    }
  } catch {
    // use defaults
  }
}

export async function saveSettings(): Promise<void> {
  await writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
}

export function getSettings(): BotSettings {
  return settings;
}

export async function setChannel(feature: string, channelId: string): Promise<void> {
  settings.channels[feature as keyof BotSettings["channels"]] = channelId;
  await saveSettings();
}

export async function updateMemeSpam(updates: Partial<BotSettings["memeSpam"]>): Promise<void> {
  settings.memeSpam = { ...settings.memeSpam, ...updates };
  await saveSettings();
}
