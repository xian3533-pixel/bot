import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
} from "discord.js";
import { setChannel } from "../store.js";

export const data = new SlashCommandBuilder()
  .setName("setchannel")
  .setDescription("Set one or more feature channels in a single command")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addChannelOption((opt) =>
    opt
      .setName("media")
      .setDescription("Channel for media only (auto-deletes non-media messages)")
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false)
  )
  .addChannelOption((opt) =>
    opt
      .setName("meme")
      .setDescription("Channel where the bot posts memes")
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false)
  )
  .addChannelOption((opt) =>
    opt
      .setName("announcements")
      .setDescription("Channel for announcements")
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false)
  )
  .addChannelOption((opt) =>
    opt
      .setName("rules")
      .setDescription("Channel for server rules")
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false)
  );

const FEATURE_LABELS: Record<string, string> = {
  media: "📷 Media Channel",
  meme: "😂 Meme Spam Channel",
  announcements: "📢 Announcements Channel",
  rules: "📋 Rules Channel",
};

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const features = ["media", "meme", "announcements", "rules"] as const;
  const updates: { feature: string; channelId: string }[] = [];

  for (const feature of features) {
    const channel = interaction.options.getChannel(feature);
    if (channel) {
      await setChannel(feature, channel.id);
      updates.push({ feature, channelId: channel.id });
    }
  }

  if (updates.length === 0) {
    await interaction.editReply(
      "You didn't provide any channels. Use at least one option, e.g. `/setchannel media:#your-channel`.\n\nFor sports channels, use `/sports setchannel` instead."
    );
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("✅ Channels Updated")
    .setDescription(
      updates
        .map((u) => `${FEATURE_LABELS[u.feature] ?? u.feature} → <#${u.channelId}>`)
        .join("\n")
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
