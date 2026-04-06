import { Message } from "discord.js";
import { getSettings } from "../store.js";

export async function handleMessageCreate(message: Message): Promise<void> {
  if (message.author.bot) return;

  const settings = getSettings();
  const mediaChannelId = settings.channels.media;
  if (!mediaChannelId) return;
  if (message.channelId !== mediaChannelId) return;

  const hasAttachment = message.attachments.size > 0;
  const hasEmbed = message.embeds.length > 0;
  const hasMediaUrl =
    message.content.match(
      /https?:\/\/[^\s]+(\.png|\.jpg|\.jpeg|\.gif|\.webp|\.mp4|\.mov|\.webm|imgur\.com|tenor\.com|giphy\.com|media\.discordapp|cdn\.discordapp)/i
    ) !== null;

  if (!hasAttachment && !hasEmbed && !hasMediaUrl) {
    await message.delete().catch(() => null);
  }
}
