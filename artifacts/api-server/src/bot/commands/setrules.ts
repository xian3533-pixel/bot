import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  TextChannel,
} from "discord.js";
import { getSettings } from "../store.js";

const THEMES: Record<string, { color: number; emoji: string }> = {
  default: { color: 0x5865f2, emoji: "📋" },
  gold:    { color: 0xf1c40f, emoji: "⭐" },
  red:     { color: 0xed4245, emoji: "🛡️" },
  green:   { color: 0x57f287, emoji: "✅" },
  dark:    { color: 0x2c2f33, emoji: "📜" },
};

export const data = new SlashCommandBuilder()
  .setName("setrules")
  .setDescription("Post the server rules with a theme")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addStringOption((opt) =>
    opt
      .setName("rules")
      .setDescription(
        'The rules content — use \\n to separate rules (e.g. "Be respectful\\nNo spamming\\nFollow Discord ToS")'
      )
      .setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName("theme")
      .setDescription("Visual theme for the rules embed")
      .setRequired(false)
      .addChoices(
        { name: "Default (Blue)", value: "default" },
        { name: "Gold (Star)", value: "gold" },
        { name: "Red (Shield)", value: "red" },
        { name: "Green (Check)", value: "green" },
        { name: "Dark (Scroll)", value: "dark" }
      )
  )
  .addStringOption((opt) =>
    opt.setName("title").setDescription("Custom title (default: Server Rules)").setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const rulesInput = interaction.options.getString("rules", true);
  const themeKey = interaction.options.getString("theme") ?? "default";
  const customTitle = interaction.options.getString("title");
  const theme = THEMES[themeKey] ?? THEMES["default"]!;

  const settings = getSettings();
  const rulesChannelId = settings.channels.rules;

  let targetChannel: TextChannel | null = null;

  if (rulesChannelId) {
    const ch = await interaction.guild?.channels.fetch(rulesChannelId).catch(() => null);
    if (ch && ch.isTextBased()) {
      targetChannel = ch as TextChannel;
    }
  }

  if (!targetChannel) {
    targetChannel = interaction.channel as TextChannel;
  }

  const rawRules = rulesInput.replace(/\\n/g, "\n");
  const lines = rawRules.split("\n").filter((l) => l.trim().length > 0);
  const formatted = lines.map((line, i) => `**${i + 1}.** ${line.trim()}`).join("\n\n");

  const title = customTitle ?? `${theme.emoji} Server Rules`;

  const embed = new EmbedBuilder()
    .setColor(theme.color)
    .setTitle(title)
    .setDescription(formatted)
    .setFooter({ text: `${interaction.guild?.name ?? "Server"} — Please follow the rules` })
    .setTimestamp();

  await targetChannel.send({ embeds: [embed] });

  await interaction.editReply(`✅ Rules posted in <#${targetChannel.id}>`);
}
