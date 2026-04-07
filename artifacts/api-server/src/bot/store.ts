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
  sportsTracker: {
    active: boolean;
    intervalMinutes: number;
    channels: Record<string, string>; // leagueKey -> channelId
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
    channels: {},
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
        sportsTracker: {
          ...settings.sportsTracker,
          ...parsed.sportsTracker,
          channels: {
            ...settings.sportsTracker.channels,
            ...(parsed.sportsTracker?.channels ?? {}),
          },
        },
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

export async function setSportsLeagueChannel(leagueKey: string, channelId: string): Promise<void> {
  settings.sportsTracker.channels[leagueKey] = channelId;
  await saveSettings();
}

export async function removeSportsLeagueChannel(leagueKey: string): Promise<void> {
  delete settings.sportsTracker.channels[leagueKey];
  await saveSettings();
}

export async function updateSportsTracker(
  updates: Partial<Omit<BotSettings["sportsTracker"], "channels">>
): Promise<void> {
  settings.sportsTracker = { ...settings.sportsTracker, ...updates };
  await saveSettings();
}
