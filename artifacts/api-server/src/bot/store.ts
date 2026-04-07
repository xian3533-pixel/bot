import { writeFile, readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

interface BotSettings {
  channels: {
    media?: string;
    meme?: string;
    announcements?: string;
    rules?: string;
    sports?: string;
  };
  memeSpam: {
    active: boolean;
    intervalMinutes: number;
  };
  sportsTracker: {
    active: boolean;
    intervalMinutes: number;
    leagues: string[];
  };
}

const SETTINGS_FILE = path.join(process.cwd(), "bot-settings.json");

let settings: BotSettings = {
  channels: {},
  memeSpam: {
    active: false,
    intervalMinutes: 30,
  },
  sportsTracker: {
    active: false,
    intervalMinutes: 30,
    leagues: ["nba", "nfl", "mlb", "nhl"],
  },
};

export async function loadSettings(): Promise<void> {
  try {
    if (existsSync(SETTINGS_FILE)) {
      const data = await readFile(SETTINGS_FILE, "utf-8");
      const parsed = JSON.parse(data) as Partial<BotSettings>;
      settings = {
        ...settings,
        ...parsed,
        channels: { ...settings.channels, ...parsed.channels },
        memeSpam: { ...settings.memeSpam, ...parsed.memeSpam },
        sportsTracker: { ...settings.sportsTracker, ...parsed.sportsTracker },
      };
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

export async function updateSportsTracker(
  updates: Partial<BotSettings["sportsTracker"]>
): Promise<void> {
  settings.sportsTracker = { ...settings.sportsTracker, ...updates };
  await saveSettings();
}
