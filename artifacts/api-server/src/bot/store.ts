import { writeFile, readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export interface LeagueConfig {
  channelId: string;
  intervalMinutes: number;
}

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
  sportsLeagues: Record<string, LeagueConfig>; // leagueKey -> { channelId, intervalMinutes }
  sportsActive: boolean;
}

const SETTINGS_FILE = path.join(process.cwd(), "bot-settings.json");

let settings: BotSettings = {
  channels: {},
  memeSpam: {
    active: false,
    intervalMinutes: 30,
  },
  sportsLeagues: {},
  sportsActive: false,
};

export async function loadSettings(): Promise<void> {
  try {
    if (existsSync(SETTINGS_FILE)) {
      const data = await readFile(SETTINGS_FILE, "utf-8");
      const parsed = JSON.parse(data) as Record<string, unknown>;

      settings.channels = (parsed["channels"] as BotSettings["channels"]) ?? {};
      settings.memeSpam = {
        ...settings.memeSpam,
        ...((parsed["memeSpam"] as Partial<BotSettings["memeSpam"]>) ?? {}),
      };
      settings.sportsActive = (parsed["sportsActive"] as boolean) ?? false;

      // Migrate old format: sportsTracker.channels -> sportsLeagues
      const oldTracker = parsed["sportsTracker"] as
        | { channels?: Record<string, string>; intervalMinutes?: number }
        | undefined;
      if (oldTracker?.channels && !parsed["sportsLeagues"]) {
        const defaultInterval = oldTracker.intervalMinutes ?? 30;
        for (const [k, chId] of Object.entries(oldTracker.channels)) {
          settings.sportsLeagues[k] = { channelId: chId, intervalMinutes: defaultInterval };
        }
      } else {
        settings.sportsLeagues =
          (parsed["sportsLeagues"] as Record<string, LeagueConfig>) ?? {};
      }
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

export async function setSportsLeague(
  leagueKey: string,
  channelId: string,
  intervalMinutes: number
): Promise<void> {
  settings.sportsLeagues[leagueKey] = { channelId, intervalMinutes };
  await saveSettings();
}

export async function updateSportsLeagueInterval(
  leagueKey: string,
  intervalMinutes: number
): Promise<void> {
  if (settings.sportsLeagues[leagueKey]) {
    settings.sportsLeagues[leagueKey]!.intervalMinutes = intervalMinutes;
    await saveSettings();
  }
}

export async function removeSportsLeague(leagueKey: string): Promise<void> {
  delete settings.sportsLeagues[leagueKey];
  await saveSettings();
}

export async function setSportsActive(active: boolean): Promise<void> {
  settings.sportsActive = active;
  await saveSettings();
}
