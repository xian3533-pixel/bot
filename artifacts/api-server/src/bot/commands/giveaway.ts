import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
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

function buildEmbed(
  prize: string,
  endsAtUnix: number,
  winnerCount: number,
  hostedBy: string,
  entrantCount: number,
  ended = false
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(ended ? 0x57f287 : 0xeb459e)
    .setTitle(ended ? "🎉 Giveaway Ended!" : "🎉 GIVEAWAY 🎉")
    .setDescription(
      [
        `**Prize:** ${prize}`,
        `**Winners:** ${winnerCount}`,
        ended
          ? `**Ended:** <t:${endsAtUnix}:f>`
          : `**Ends:** <t:${endsAtUnix}:R> (<t:${endsAtUnix}:f>)`,
        `**Hosted by:** <@${hostedBy}>`,
        `**Entries:** ${entrantCount}`,
        "",
        ended ? "The giveaway has ended." : "Click the button below to enter!",
      ].join("\n")
    )
    .setFooter({ text: ended ? "Giveaway ended" : "Click to enter" })
    .setTimestamp();
}

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
  const hostId = interaction.user.id;
  const entrants = new Set<string>();

  const enterButton = new ButtonBuilder()
    .setCustomId("giveaway_enter")
    .setLabel("🎉 Enter Giveaway")
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(enterButton);

  const giveawayMessage = await targetChannel.send({
    embeds: [buildEmbed(prize, endsAtUnix, winnerCount, hostId, 0)],
    components: [row],
  });

  await interaction.editReply(
    `✅ Giveaway started in <#${targetChannel.id}>! It ends <t:${endsAtUnix}:R>.`
  );

  const collector = giveawayMessage.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: durationMinutes * 60 * 1000,
  });

  collector.on("collect", async (btnInteraction) => {
    if (btnInteraction.customId !== "giveaway_enter") return;

    if (entrants.has(btnInteraction.user.id)) {
      await btnInteraction.reply({
        content: "You've already entered this giveaway!",
        ephemeral: true,
      });
      return;
    }

    entrants.add(btnInteraction.user.id);

    await btnInteraction.reply({
      content: `🎉 You've entered the **${prize}** giveaway! Good luck!`,
      ephemeral: true,
    });

    await giveawayMessage
      .edit({
        embeds: [buildEmbed(prize, endsAtUnix, winnerCount, hostId, entrants.size)],
      })
      .catch(() => null);
  });

  collector.on("end", async () => {
    const disabledButton = ButtonBuilder.from(enterButton)
      .setDisabled(true)
      .setLabel("🎉 Giveaway Ended");

    const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(disabledButton);

    if (entrants.size === 0) {
      await giveawayMessage
        .edit({
          embeds: [buildEmbed(prize, endsAtUnix, winnerCount, hostId, 0, true)],
          components: [disabledRow],
        })
        .catch(() => null);
      await targetChannel
        .send(`🎉 The **${prize}** giveaway ended with no entries.`)
        .catch(() => null);
      return;
    }

    const entryArray = [...entrants];
    const shuffled = entryArray.sort(() => Math.random() - 0.5);
    const winners = shuffled.slice(0, Math.min(winnerCount, entryArray.length));
    const winnerMentions = winners.map((id) => `<@${id}>`).join(", ");

    await giveawayMessage
      .edit({
        embeds: [buildEmbed(prize, endsAtUnix, winnerCount, hostId, entrants.size, true)],
        components: [disabledRow],
      })
      .catch(() => null);

    await targetChannel
      .send(
        `🎉 Congratulations ${winnerMentions}! You won **${prize}**! Thanks to everyone who entered.`
      )
      .catch(() => null);
  });
}
