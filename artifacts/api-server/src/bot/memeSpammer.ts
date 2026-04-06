import { Client, TextChannel, EmbedBuilder } from "discord.js";
import { getSettings, updateMemeSpam } from "./store.js";
import { logger } from "../lib/logger.js";

let spamTimer: ReturnType<typeof setInterval> | null = null;

async function fetchMeme(): Promise<{ title: string; url: string; postLink: string } | null> {
  try {
    const res = await fetch("https://meme-api.com/gimme");
    if (!res.ok) return null;
    const data = (await res.json()) as { title: string; url: string; postLink: string; nsfw: boolean };
    if (data.nsfw) return fetchMeme();
    return data;
  } catch {
    return null;
  }
}

async function postMeme(client: Client): Promise<void> {
  const settings = getSettings();
  const channelId = settings.channels.meme;
  if (!channelId) return;

  const channel = client.channels.cache.get(channelId) as TextChannel | undefined;
  if (!channel) return;

  const meme = await fetchMeme();
  if (!meme) return;

  const embed = new EmbedBuilder()
    .setColor(0xeb459e)
    .setTitle(meme.title)
    .setImage(meme.url)
    .setURL(meme.postLink)
    .setFooter({ text: "🤣 Auto Meme Spam" })
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch((err: unknown) => {
    logger.error({ err }, "Failed to post meme");
  });
}

export function startMemeSpam(client: Client, intervalMinutes: number): void {
  stopMemeSpam();
  const ms = intervalMinutes * 60 * 1000;
  spamTimer = setInterval(() => {
    postMeme(client).catch((err: unknown) => logger.error({ err }, "Meme spam error"));
  }, ms);
  logger.info({ intervalMinutes }, "Meme spam started");
}

export function stopMemeSpam(): void {
  if (spamTimer) {
    clearInterval(spamTimer);
    spamTimer = null;
    logger.info("Meme spam stopped");
  }
}

export function isMemeSpamActive(): boolean {
  return spamTimer !== null;
}

export async function initMemeSpam(client: Client): Promise<void> {
  const settings = getSettings();
  if (settings.memeSpam.active && settings.channels.meme) {
    startMemeSpam(client, settings.memeSpam.intervalMinutes);
  }
}

export async function toggleMemeSpam(
  client: Client,
  active: boolean,
  intervalMinutes?: number
): Promise<void> {
  const settings = getSettings();
  const interval = intervalMinutes ?? settings.memeSpam.intervalMinutes;

  await updateMemeSpam({ active, intervalMinutes: interval });

  if (active) {
    startMemeSpam(client, interval);
  } else {
    stopMemeSpam();
  }
}
