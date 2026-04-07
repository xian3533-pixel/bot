import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
} from "discord.js";
import { getSettings, setSportsLeagueChannel, removeSportsLeagueChannel } from "../store.js";
import {
  fetchScores,
  toggleSportsTracker,
  isSportsTrackerActive,
  LEAGUES,
} from "../sportsTracker.js";

const LEAGUE_CHOICES = Object.entries(LEAGUES).map(([value, info]) => ({
  name: `${info.emoji} ${info.name}`,
  value,
}));

export const data = new SlashCommandBuilder()
  .setName("sports")
  .setDescription("Sports scores and per-league channel controls")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addSubcommand((sub) =>
    sub
      .setName("scores")
      .setDescription("Get current scores for a league right now (posts in this channel)")
      .addStringOption((opt) =>
        opt
          .setName("league")
          .setDescription("Which league to check")
          .setRequired(true)
          .addChoices(...LEAGUE_CHOICES)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("setchannel")
      .setDescription("Assign a channel for a specific league's auto-updates")
      .addStringOption((opt) =>
        opt
          .setName("league")
          .setDescription("Which league to assign")
          .setRequired(true)
          .addChoices(...LEAGUE_CHOICES)
      )
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("The channel to post this league's updates in (defaults to current channel)")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("removechannel")
      .setDescription("Remove a league from auto-updates")
      .addStringOption((opt) =>
        opt
          .setName("league")
          .setDescription("Which league to remove")
          .setRequired(true)
          .addChoices(...LEAGUE_CHOICES)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("start")
      .setDescription("Start auto-posting scores to each league's assigned channel")
      .addIntegerOption((opt) =>
        opt
          .setName("interval")
          .setDescription("How often to post scores (in minutes, default: 30)")
          .setMinValue(5)
          .setMaxValue(1440)
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("stop").setDescription("Stop auto-posting sports scores")
  )
  .addSubcommand((sub) =>
    sub.setName("status").setDescription("Show all leagues and their assigned channels")
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === "scores") {
    await interaction.deferReply();
    const leagueKey = interaction.options.getString("league", true);
    const embed = await fetchScores(leagueKey);
    if (!embed) {
      await interaction.editReply("Failed to fetch scores. Please try again later.");
      return;
    }
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const settings = getSettings();

  if (sub === "setchannel") {
    const leagueKey = interaction.options.getString("league", true);
    const targetChannel = interaction.options.getChannel("channel") ?? interaction.channel;

    if (!targetChannel) {
      await interaction.editReply("Could not determine the channel.");
      return;
    }

    const info = LEAGUES[leagueKey];
    await setSportsLeagueChannel(leagueKey, targetChannel.id);

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(info?.color ?? 0x5865f2)
          .setTitle("✅ League Channel Set")
          .setDescription(
            `${info?.emoji ?? ""} **${info?.name ?? leagueKey}** updates will now post in <#${targetChannel.id}>`
          )
          .setTimestamp(),
      ],
    });
    return;
  }

  if (sub === "removechannel") {
    const leagueKey = interaction.options.getString("league", true);
    const info = LEAGUES[leagueKey];
    await removeSportsLeagueChannel(leagueKey);

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("🗑️ League Removed")
          .setDescription(
            `${info?.emoji ?? ""} **${info?.name ?? leagueKey}** has been removed from auto-updates.`
          )
          .setTimestamp(),
      ],
    });
    return;
  }

  if (sub === "start") {
    const leagueChannels = settings.sportsTracker.channels;
    if (Object.keys(leagueChannels).length === 0) {
      await interaction.editReply(
        "No league channels set yet! Use `/sports setchannel` to assign a channel to at least one league first."
      );
      return;
    }

    const interval =
      interaction.options.getInteger("interval") ?? settings.sportsTracker.intervalMinutes;
    await toggleSportsTracker(interaction.client, true, interval);

    const leagueList = Object.entries(leagueChannels)
      .map(([k, chId]) => `${LEAGUES[k]?.emoji ?? ""} **${LEAGUES[k]?.name ?? k}** → <#${chId}>`)
      .join("\n");

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x009c3b)
          .setTitle("📡 Sports Tracker Started!")
          .addFields(
            { name: "Interval", value: `Every ${interval} minute(s)`, inline: true },
            { name: "Active Leagues & Channels", value: leagueList, inline: false }
          )
          .setTimestamp(),
      ],
    });
    return;
  }

  if (sub === "stop") {
    await toggleSportsTracker(interaction.client, false);
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("🛑 Sports Tracker Stopped")
          .setDescription("No more auto-updates will be posted.")
          .setTimestamp(),
      ],
    });
    return;
  }

  if (sub === "status") {
    const active = isSportsTrackerActive();
    const leagueChannels = settings.sportsTracker.channels;

    const allLeagueLines = Object.entries(LEAGUES).map(([key, info]) => {
      const chId = leagueChannels[key];
      const channelStr = chId ? `<#${chId}>` : "_Not set_";
      return `${info.emoji} **${info.name}** — ${channelStr}`;
    });

    const embed = new EmbedBuilder()
      .setColor(active ? 0x57f287 : 0xed4245)
      .setTitle("📊 Sports Tracker Status")
      .addFields(
        { name: "Status", value: active ? "🟢 Running" : "🔴 Stopped", inline: true },
        {
          name: "Interval",
          value: `${settings.sportsTracker.intervalMinutes} minute(s)`,
          inline: true,
        },
        { name: "League Channels", value: allLeagueLines.join("\n"), inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}
