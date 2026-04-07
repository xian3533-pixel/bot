import { Client, TextChannel, EmbedBuilder } from "discord.js";
import { getSettings, updateSportsTracker } from "./store.js";
import { logger } from "../lib/logger.js";

export const LEAGUES: Record<
  string,
  { name: string; emoji: string; sport: string; league: string; color: number }
> = {
  nba:      { name: "NBA",                    emoji: "🏀", sport: "basketball",  league: "nba",                         color: 0xc9082a },
  wnba:     { name: "WNBA",                   emoji: "🏀", sport: "basketball",  league: "wnba",                        color: 0x1d1160 },
  ncaab:    { name: "NCAA Basketball (Men)",  emoji: "🏀", sport: "basketball",  league: "mens-college-basketball",     color: 0x003087 },
  nfl:      { name: "NFL",                    emoji: "🏈", sport: "football",    league: "nfl",                         color: 0x013369 },
  ncaaf:    { name: "NCAA Football",          emoji: "🏈", sport: "football",    league: "college-football",            color: 0xc41230 },
  mlb:      { name: "MLB",                    emoji: "⚾", sport: "baseball",    league: "mlb",                         color: 0x002d72 },
  nhl:      { name: "NHL",                    emoji: "🏒", sport: "hockey",      league: "nhl",                         color: 0x0033a0 },
  mls:      { name: "MLS",                    emoji: "⚽", sport: "soccer",      league: "usa.1",                       color: 0x005293 },
  epl:      { name: "Premier League",         emoji: "⚽", sport: "soccer",      league: "eng.1",                       color: 0x3d195b },
  laliga:   { name: "La Liga",                emoji: "⚽", sport: "soccer",      league: "esp.1",                       color: 0xee8707 },
  bundesliga: { name: "Bundesliga",           emoji: "⚽", sport: "soccer",      league: "ger.1",                       color: 0xd3010c },
  seriea:   { name: "Serie A",                emoji: "⚽", sport: "soccer",      league: "ita.1",                       color: 0x024494 },
  ucl:      { name: "UEFA Champions League",  emoji: "🏆", sport: "soccer",      league: "uefa.champions",              color: 0x062c82 },
  nba2:     { name: "NBA G League",           emoji: "🏀", sport: "basketball",  league: "nba-gleague",                 color: 0x00538c },
};

interface EspnCompetitor {
  homeAway: string;
  team: { displayName: string; abbreviation: string; logo?: string };
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
      const embed = new EmbedBuilder()
        .setColor(info.color)
        .setTitle(`${info.emoji} ${info.name} Scores`)
        .setDescription("No games scheduled today.")
        .setTimestamp();
      return embed;
    }

    const lines: string[] = [];

    for (const event of events) {
      const comp = event.competitions[0];
      if (!comp) continue;

      const [c1, c2] = comp.competitors;
      if (!c1 || !c2) continue;

      const home = c1.homeAway === "home" ? c1 : c2;
      const away = c1.homeAway === "away" ? c1 : c2;

      const statusDetail = event.status.type.shortDetail;
      const isLive =
        event.status.type.name === "STATUS_IN_PROGRESS" ||
        event.status.type.name === "STATUS_HALFTIME";
      const isFinal = event.status.type.completed;

      const homeScore = home.score ?? "—";
      const awayScore = away.score ?? "—";

      let statusStr: string;
      if (isFinal) {
        statusStr = `**Final**`;
      } else if (isLive) {
        statusStr = `🔴 **LIVE** — ${statusDetail}`;
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

    const embed = new EmbedBuilder()
      .setColor(info.color)
      .setTitle(`${info.emoji} ${info.name} — Today's Games`)
      .setDescription(lines.join("\n\n") || "No game data available.")
      .setFooter({ text: "Powered by ESPN" })
      .setTimestamp();

    return embed;
  } catch (err) {
    logger.error({ err, leagueKey }, "Failed to fetch ESPN scores");
    return null;
  }
}

let sportsTimer: ReturnType<typeof setInterval> | null = null;

async function postAllScores(client: Client): Promise<void> {
  const settings = getSettings();
  const channelId = settings.channels.sports;
  if (!channelId) return;

  const channel = client.channels.cache.get(channelId) as TextChannel | undefined;
  if (!channel) return;

  const leagues = settings.sportsTracker.leagues;
  const embeds: EmbedBuilder[] = [];

  for (const leagueKey of leagues) {
    const embed = await fetchScores(leagueKey);
    if (embed) embeds.push(embed);
  }

  if (embeds.length === 0) return;

  const chunks: EmbedBuilder[][] = [];
  for (let i = 0; i < embeds.length; i += 10) {
    chunks.push(embeds.slice(i, i + 10));
  }

  for (const chunk of chunks) {
    await channel.send({ embeds: chunk }).catch((err: unknown) =>
      logger.error({ err }, "Failed to post sports scores")
    );
  }
}

export function startSportsTracker(client: Client, intervalMinutes: number): void {
  stopSportsTracker();
  const ms = intervalMinutes * 60 * 1000;
  sportsTimer = setInterval(() => {
    postAllScores(client).catch((err: unknown) =>
      logger.error({ err }, "Sports tracker error")
    );
  }, ms);
  logger.info({ intervalMinutes }, "Sports tracker started");
}

export function stopSportsTracker(): void {
  if (sportsTimer) {
    clearInterval(sportsTimer);
    sportsTimer = null;
    logger.info("Sports tracker stopped");
  }
}

export function isSportsTrackerActive(): boolean {
  return sportsTimer !== null;
}

export async function initSportsTracker(client: Client): Promise<void> {
  const settings = getSettings();
  if (settings.sportsTracker.active && settings.channels.sports) {
    startSportsTracker(client, settings.sportsTracker.intervalMinutes);
  }
}

export async function toggleSportsTracker(
  client: Client,
  active: boolean,
  intervalMinutes?: number,
  leagues?: string[]
): Promise<void> {
  const settings = getSettings();
  const interval = intervalMinutes ?? settings.sportsTracker.intervalMinutes;
  const leagueList = leagues ?? settings.sportsTracker.leagues;

  await updateSportsTracker({ active, intervalMinutes: interval, leagues: leagueList });

  if (active) {
    startSportsTracker(client, interval);
  } else {
    stopSportsTracker();
  }
}
