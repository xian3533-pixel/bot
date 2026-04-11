import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  TextChannel,
} from "discord.js";
import { getSettings } from "../store.js";

const THEMES: Record<string, { color: number; emoji: string; label: string }> = {
  default: { color: 0x5865f2, emoji: "📢", label: "Announcement" },
  alert:   { color: 0xed4245, emoji: "🚨", label: "Alert" },
  info:    { color: 0x5865f2, emoji: "ℹ️", label: "Info" },
  success: { color: 0x57f287, emoji: "✅", label: "Update" },
  warning: { color: 0xfee75c, emoji: "⚠️", label: "Warning" },
  event:   { color: 0xeb459e, emoji: "🎉", label: "Event" },
};

export const data = new SlashCommandBuilder()
  .setName("announce")
  .setDescription("Post a themed announcement")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addStringOption((opt) =>
    opt.setName("message").setDescription("The announcement message").setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName("theme")
      .setDescription("Visual theme for the announcement")
      .setRequired(false)
      .addChoices(
        { name: "Default (Blue)", value: "default" },
        { name: "Alert (Red)", value: "alert" },
        { name: "Info (Blue)", value: "info" },
        { name: "Success (Green)", value: "success" },
        { name: "Warning (Yellow)", value: "warning" },
        { name: "Event (Pink)", value: "event" }
      )
  )
  .addStringOption((opt) =>
    opt.setName("title").setDescription("Custom title for the announcement").setRequired(false)
  )
  .addChannelOption((opt) =>
    opt.setName("channel").setDescription("Channel to post in (overrides the saved announcements channel)").setRequired(false)
  )
  .addAttachmentOption((opt) =>
    opt.setName("image").setDescription("Image to include in the announcement").setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const message = interaction.options.getString("message", true);
  const themeKey = interaction.options.getString("theme") ?? "default";
  const customTitle = interaction.options.getString("title");
  const channelOption = interaction.options.getChannel("channel");
  const imageAttachment = interaction.options.getAttachment("image");
  const theme = THEMES[themeKey] ?? THEMES["default"]!;

  const settings = getSettings();
  const announcementsChannelId = settings.channels.announcements;

  let targetChannel: TextChannel | null = null;

  // If a channel was explicitly passed, use it first
  if (channelOption) {
    const ch = await interaction.guild?.channels.fetch(channelOption.id).catch(() => null);
    if (ch && ch.isTextBased()) {
      targetChannel = ch as TextChannel;
    }
  }

  // Fall back to saved announcements channel, then current channel
  if (!targetChannel && announcementsChannelId) {
    const ch = await interaction.guild?.channels.fetch(announcementsChannelId).catch(() => null);
    if (ch && ch.isTextBased()) {
      targetChannel = ch as TextChannel;
    }
  }

  if (!targetChannel) {
    targetChannel = interaction.channel as TextChannel;
  }

  const title = customTitle ?? `${theme.emoji} ${theme.label}`;

  const embed = new EmbedBuilder()
    .setColor(theme.color)
    .setTitle(title)
    .setDescription(message)
    .setFooter({ text: `Posted by ${interaction.user.tag}` })
    .setTimestamp();

  if (imageAttachment && imageAttachment.contentType?.startsWith("image/")) {
    embed.setImage(imageAttachment.url);
  }

  await targetChannel.send({
    content: announcementsChannelId ? `<#${announcementsChannelId}>` : undefined,
    embeds: [embed],
  });

  await interaction.editReply(
    `✅ Announcement posted in <#${targetChannel.id}>`
  );
}
