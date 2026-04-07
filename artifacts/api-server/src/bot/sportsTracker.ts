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
  status: { type: { name: string; shortDetail: string; completed: boolean } };
  competitions: Array<{ competitors: EspnCompetitor[] }>;
}

interface EspnScoreboard {
  events?: EspnEvent[];
}

export async function fetchScores(leagueKey: string): Promise<EmbedBuilder | null> {
  const info = LEAGUES[leagueKey];
  if (!info) return null;

  const url = `https://site.api.espn.com/apis/site/v2/sports/${info.sport}/${info.league}/scoreboard`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;

    const data = (await res.json()) as EspnScoreboard;
    const events = data.events ?? [];

    if (events.length === 0) {
      return new EmbedBuilder()
        .setColor(info.color)
        .setTitle(`${info.emoji} ${info.name} Scores`)
        .setDescription("No games scheduled today.")
        .setTimestamp();
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

    return new EmbedBuilder()
      .setColor(info.color)
      .setTitle(`${info.emoji} ${info.name} — Today's Games`)
      .setDescription(lines.join("\n\n") || "No game data available.")
      .setFooter({ text: "Powered by ESPN" })
      .setTimestamp();
  } catch (err) {
    logger.error({ err, leagueKey }, "Failed to fetch ESPN scores");
    return null;
  }
}

// Per-league independent timers
const leagueTimers = new Map<string, ReturnType<typeof setInterval>>();

async function postLeagueScores(client: Client, leagueKey: string): Promise<void> {
  const settings = getSettings();
  const config = settings.sportsLeagues[leagueKey];
  if (!config) return;

  const channel = client.channels.cache.get(config.channelId) as TextChannel | undefined;
  if (!channel) return;

  const embed = await fetchScores(leagueKey);
  if (!embed) return;

  await channel.send({ embeds: [embed] }).catch((err: unknown) =>
    logger.error({ err, leagueKey }, "Failed to post league scores")
  );
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
  const timer = leagueTimers.get(leagueKey);
  if (timer) {
    clearInterval(timer);
    leagueTimers.delete(leagueKey);
    logger.info({ leagueKey }, "League tracker stopped");
  }
}

export function stopAllLeagues(): void {
  for (const [key] of leagueTimers) {
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

export async function initSportsTracker(client: Client): Promise<void> {
  const settings = getSettings();
  if (!settings.sportsActive) return;

  for (const [leagueKey, config] of Object.entries(settings.sportsLeagues)) {
    startLeague(client, leagueKey, config.intervalMinutes);
  }
}

export async function startAllLeagues(client: Client): Promise<void> {
  const settings = getSettings();
  await setSportsActive(true);
  for (const [leagueKey, config] of Object.entries(settings.sportsLeagues)) {
    startLeague(client, leagueKey, config.intervalMinutes);
  }
}

export async function stopAllLeaguesAndSave(): Promise<void> {
  stopAllLeagues();
  await setSportsActive(false);
}
