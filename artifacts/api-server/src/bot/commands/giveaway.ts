import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  TextChannel,
  GuildMember,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("giveaway")
  .setDescription("Host a giveaway in a channel")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addStringOption((opt) =>
    opt.setName("prize").setDescription("What are you giving away?").setRequired(true)
  )
  .addIntegerOption((opt) =>
    opt
      .setName("duration")
      .setDescription("How long the giveaway lasts (in minutes)")
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(10080)
  )
  .addIntegerOption((opt) =>
    opt
      .setName("winners")
      .setDescription("Number of winners (default: 1)")
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(20)
  )
  .addChannelOption((opt) =>
    opt
      .setName("channel")
      .setDescription("Channel to host the giveaway in (defaults to current channel)")
      .setRequired(false)
  );

const GIVEAWAY_EMOJI = "🎉";

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const prize = interaction.options.getString("prize", true);
  const durationMinutes = interaction.options.getInteger("duration", true);
  const winnerCount = interaction.options.getInteger("winners") ?? 1;
  const channelOption = interaction.options.getChannel("channel");

  let targetChannel: TextChannel;

  if (channelOption) {
    const ch = await interaction.guild?.channels.fetch(channelOption.id).catch(() => null);
    if (!ch || !ch.isTextBased()) {
      await interaction.editReply("❌ That channel is not a valid text channel.");
      return;
    }
    targetChannel = ch as TextChannel;
  } else {
    targetChannel = interaction.channel as TextChannel;
  }

  const endsAt = new Date(Date.now() + durationMinutes * 60 * 1000);
  const endsAtUnix = Math.floor(endsAt.getTime() / 1000);

  const embed = new EmbedBuilder()
    .setColor(0xeb459e)
    .setTitle(`${GIVEAWAY_EMOJI} GIVEAWAY ${GIVEAWAY_EMOJI}`)
    .setDescription(
      [
        `**Prize:** ${prize}`,
        `**Winners:** ${winnerCount}`,
        `**Ends:** <t:${endsAtUnix}:R> (<t:${endsAtUnix}:f>)`,
        `**Hosted by:** ${interaction.user}`,
        "",
        `React with ${GIVEAWAY_EMOJI} to enter!`,
      ].join("\n")
    )
    .setFooter({ text: `Ends at` })
    .setTimestamp(endsAt);

  const giveawayMessage = await targetChannel.send({ embeds: [embed] });
  await giveawayMessage.react(GIVEAWAY_EMOJI);

  await interaction.editReply(
    `✅ Giveaway started in <#${targetChannel.id}>! It ends <t:${endsAtUnix}:R>.`
  );

  setTimeout(async () => {
    try {
      const fetched = await giveawayMessage.fetch();
      const reaction = fetched.reactions.cache.get(GIVEAWAY_EMOJI);

      if (!reaction) {
        await targetChannel.send(`${GIVEAWAY_EMOJI} The **${prize}** giveaway ended with no entries.`);
        return;
      }

      const users = await reaction.users.fetch();
      const entries = users.filter((u) => !u.bot);

      if (entries.size === 0) {
        await targetChannel.send(`${GIVEAWAY_EMOJI} The **${prize}** giveaway ended with no valid entries.`);
        return;
      }

      const entryArray = [...entries.values()];
      const shuffled = entryArray.sort(() => Math.random() - 0.5);
      const winners = shuffled.slice(0, Math.min(winnerCount, entryArray.length));
      const winnerMentions = winners.map((u) => `<@${u.id}>`).join(", ");

      const endEmbed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle(`${GIVEAWAY_EMOJI} Giveaway Ended!`)
        .setDescription(
          [
            `**Prize:** ${prize}`,
            `**Winner${winners.length > 1 ? "s" : ""}:** ${winnerMentions}`,
            `**Hosted by:** <@${interaction.user.id}>`,
          ].join("\n")
        )
        .setTimestamp();

      await giveawayMessage.edit({ embeds: [endEmbed] });
      await targetChannel.send(
        `${GIVEAWAY_EMOJI} Congratulations ${winnerMentions}! You won **${prize}**!`
      );
    } catch {
      await targetChannel
        .send(`${GIVEAWAY_EMOJI} The **${prize}** giveaway has ended but I couldn't determine a winner.`)
        .catch(() => null);
    }
  }, durationMinutes * 60 * 1000);
}
