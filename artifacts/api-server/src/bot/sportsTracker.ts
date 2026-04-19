import { Client, TextChannel, EmbedBuilder } from "discord.js";
import { getSettings, setSportsActive } from "./store.js";
import { logger } from "../lib/logger.js";

export const LEAGUES: Record<
  string,
  { name: string; emoji: string; sport: string; league: string; color: number }
> = {
  nba:        { name: "NBA",              emoji: "🏀", sport: "basketball", league: "nba",                     color: 0xc9082a },
  wnba:       { name: "WNBA",             emoji: "🏀", sport: "basketball", league: "wnba",                    color: 0x1d1160 },
  ncaab:      { name: "NCAA Basketball",  emoji: "🏀", sport: "basketball", league: "mens-college-basketball", color: 0x003087 },
  nfl:        { name: "NFL",              emoji: "🏈", sport: "football",   league: "nfl",                     color: 0x013369 },
  ncaaf:      { name: "NCAA Football",    emoji: "🏈", sport: "football",   league: "college-football",        color: 0xc41230 },
  mlb:        { name: "MLB",              emoji: "⚾", sport: "baseball",   league: "mlb",                     color: 0x002d72 },
  nhl:        { name: "NHL",              emoji: "🏒", sport: "hockey",     league: "nhl",                     color: 0x0033a0 },
  mls:        { name: "MLS",              emoji: "⚽", sport: "soccer",     league: "usa.1",                   color: 0x005293 },
  epl:        { name: "Premier League",   emoji: "⚽", sport: "soccer",     league: "eng.1",                   color: 0x3d195b },
  laliga:     { name: "La Liga",          emoji: "⚽", sport: "soccer",     league: "esp.1",                   color: 0xee8707 },
  bundesliga: { name: "Bundesliga",       emoji: "⚽", sport: "soccer",     league: "ger.1",                   color: 0xd3010c },
  seriea:     { name: "Serie A",          emoji: "⚽", sport: "soccer",     league: "ita.1",                   color: 0x024494 },
  ucl:        { name: "Champions League", emoji: "🏆", sport: "soccer",     league: "uefa.champions",          color: 0x062c82 },
};

interface EspnCompetitor {
  homeAway: string;
  team: { displayName: string; abbreviation: string };
  score?: string;
  records?: { summary: string }[];
}

interface EspnEvent {
  id: string;
  name: string;
  date: string;
  status: { type: { id: string; name: string; shortDetail: string; completed: boolean } };
  competitions: Array<{ competitors: EspnCompetitor[] }>;
}

// ESPN status type IDs that mean a game is permanently over (Final, Canceled, Forfeit)
const TERMINAL_STATUS_IDS = new Set(["3", "4", "5"]);

function isTerminalStatus(event: EspnEvent): boolean {
  return (
    TERMINAL_STATUS_IDS.has(event.status.type.id) ||
    event.status.type.completed ||
    event.status.type.name.includes("FINAL") ||
    event.status.type.name.includes("CANCELED") ||
    event.status.type.name.includes("FORFEIT") ||
    event.status.type.name.includes("POSTPONED")
  );
}

interface EspnScoreboard {
  events?: EspnEvent[];
}

interface LeagueData {
  embed: EmbedBuilder;
  allTerminal: boolean;
  hasGames: boolean;
}

async function fetchLeagueData(leagueKey: string): Promise<LeagueData | null> {
  const info = LEAGUES[leagueKey];
  if (!info) return null;

  const url = `https://site.api.espn.com/apis/site/v2/sports/${info.sport}/${info.league}/scoreboard`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;

    const data = (await res.json()) as EspnScoreboard;
    const events = data.events ?? [];

    if (events.length === 0) {
      return {
        embed: new EmbedBuilder()
          .setColor(info.color)
          .setTitle(`${info.emoji} ${info.name} Scores`)
          .setDescription("No games scheduled today.")
          .setTimestamp(),
        allTerminal: false,
        hasGames: false,
      };
    }

    const lines: string[] = [];
    for (const event of events) {
      const comp = event.competitions[0];
      if (!comp) continue;
      const [c1, c2] = comp.competitors;
      if (!c1 || !c2) continue;

      const home = c1.homeAway === "home" ? c1 : c2;
      const away = c1.homeAway === "away" ? c1 : c2;
      const isLive =
        event.status.type.name === "STATUS_IN_PROGRESS" ||
        event.status.type.name === "STATUS_HALFTIME";
      const isFinal = event.status.type.completed;
      const homeScore = home.score ?? "—";
      const awayScore = away.score ?? "—";

      let statusStr: string;
      if (isFinal) {
        statusStr = "**Final**";
      } else if (isLive) {
        statusStr = `🔴 **LIVE** — ${event.status.type.shortDetail}`;
      } else {
        const gameDate = new Date(event.date);
        statusStr = `<t:${Math.floor(gameDate.getTime() / 1000)}:t>`;
      }

      const homeRec = home.records?.[0]?.summary ? ` (${home.records[0].summary})` : "";
      const awayRec = away.records?.[0]?.summary ? ` (${away.records[0].summary})` : "";
      lines.push(
        `**${away.team.abbreviation}**${awayRec} ${awayScore} — ${homeScore} **${home.team.abbreviation}**${homeRec}\n${statusStr}`
      );
    }

    const allTerminal = events.length > 0 && events.every(isTerminalStatus);

    return {
      embed: new EmbedBuilder()
        .setColor(info.color)
        .setTitle(`${info.emoji} ${info.name} — Today's Games`)
        .setDescription(lines.join("\n\n") || "No game data available.")
        .setFooter({ text: "Powered by ESPN" })
        .setTimestamp(),
      allTerminal,
      hasGames: true,
    };
  } catch (err) {
    logger.error({ err, leagueKey }, "Failed to fetch ESPN scores");
    return null;
  }
}

export async function fetchScores(leagueKey: string): Promise<EmbedBuilder | null> {
  const result = await fetchLeagueData(leagueKey);
  return result?.embed ?? null;
}

// Per-league independent timers
const leagueTimers = new Map<string, ReturnType<typeof setInterval>>();
// Pending stagger timeouts (cancelled on stop)
const staggerTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const STAGGER_SECONDS = 30;

async function postLeagueScores(client: Client, leagueKey: string): Promise<void> {
  const settings = getSettings();
  const config = settings.sportsLeagues[leagueKey];
  if (!config) return;

  const channel = client.channels.cache.get(config.channelId) as TextChannel | undefined;
  if (!channel) return;

  const result = await fetchLeagueData(leagueKey);
  if (!result) return;

  await channel.send({ embeds: [result.embed] }).catch((err: unknown) =>
    logger.error({ err, leagueKey }, "Failed to post league scores")
  );

  // If every game today is in a terminal state, stop the timer automatically
  if (result.hasGames && result.allTerminal) {
    logger.info({ leagueKey }, "All games finished — stopping auto-updates for this league");
    stopLeague(leagueKey);
    const info = LEAGUES[leagueKey];
    await channel
      .send(
        `✅ All **${info?.name ?? leagueKey}** games for today are final. Auto-updates have been stopped.`
      )
      .catch(() => null);
  }
}

export function startLeague(client: Client, leagueKey: string, intervalMinutes: number): void {
  stopLeague(leagueKey);
  const ms = intervalMinutes * 60 * 1000;
  const timer = setInterval(() => {
    postLeagueScores(client, leagueKey).catch((err: unknown) =>
      logger.error({ err, leagueKey }, "League timer error")
    );
  }, ms);
  leagueTimers.set(leagueKey, timer);
  logger.info({ leagueKey, intervalMinutes }, "League tracker started");
}

export function stopLeague(leagueKey: string): void {
  const pending = staggerTimeouts.get(leagueKey);
  if (pending) {
    clearTimeout(pending);
    staggerTimeouts.delete(leagueKey);
  }
  const timer = leagueTimers.get(leagueKey);
  if (timer) {
    clearInterval(timer);
    leagueTimers.delete(leagueKey);
    logger.info({ leagueKey }, "League tracker stopped");
  }
}

export function stopAllLeagues(): void {
  for (const [key] of [...leagueTimers.keys(), ...staggerTimeouts.keys()]) {
    stopLeague(key);
  }
}

export function isLeagueActive(leagueKey: string): boolean {
  return leagueTimers.has(leagueKey);
}

export function isAnyLeagueActive(): boolean {
  return leagueTimers.size > 0;
}

export function getActiveLeagues(): string[] {
  return [...leagueTimers.keys()];
}

function scheduleLeaguesStaggered(
  client: Client,
  entries: [string, { channelId: string; intervalMinutes: number }][]
): void {
  entries.forEach(([leagueKey, config], index) => {
    const delayMs = index * STAGGER_SECONDS * 1000;
    if (delayMs === 0) {
      startLeague(client, leagueKey, config.intervalMinutes);
    } else {
      const t = setTimeout(() => {
        staggerTimeouts.delete(leagueKey);
        startLeague(client, leagueKey, config.intervalMinutes);
      }, delayMs);
      staggerTimeouts.set(leagueKey, t);
      logger.info({ leagueKey, delaySeconds: index * STAGGER_SECONDS }, "League scheduled with stagger");
    }
  });
}

export async function initSportsTracker(client: Client): Promise<void> {
  const settings = getSettings();
  if (!settings.sportsActive) return;
  scheduleLeaguesStaggered(client, Object.entries(settings.sportsLeagues));
}

export async function startAllLeagues(client: Client): Promise<void> {
  const settings = getSettings();
  await setSportsActive(true);
  scheduleLeaguesStaggered(client, Object.entries(settings.sportsLeagues));
}

export async function stopAllLeaguesAndSave(): Promise<void> {
  stopAllLeagues();
  await setSportsActive(false);
}
