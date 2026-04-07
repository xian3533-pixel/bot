import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { getSettings } from "../store.js";
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
  .setDescription("Sports scores and auto-update controls")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addSubcommand((sub) =>
    sub
      .setName("scores")
      .setDescription("Get current scores for a league right now")
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
      .setName("start")
      .setDescription("Start auto-posting scores to the sports channel")
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
    sub
      .setName("leagues")
      .setDescription("Choose which leagues are included in auto-updates")
      .addStringOption((opt) =>
        opt
          .setName("nba")
          .setDescription("Include NBA?")
          .addChoices({ name: "Yes", value: "yes" }, { name: "No", value: "no" })
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName("nfl")
          .setDescription("Include NFL?")
          .addChoices({ name: "Yes", value: "yes" }, { name: "No", value: "no" })
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName("mlb")
          .setDescription("Include MLB?")
          .addChoices({ name: "Yes", value: "yes" }, { name: "No", value: "no" })
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName("nhl")
          .setDescription("Include NHL?")
          .addChoices({ name: "Yes", value: "yes" }, { name: "No", value: "no" })
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName("ncaaf")
          .setDescription("Include NCAA Football?")
          .addChoices({ name: "Yes", value: "yes" }, { name: "No", value: "no" })
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName("ncaab")
          .setDescription("Include NCAA Basketball?")
          .addChoices({ name: "Yes", value: "yes" }, { name: "No", value: "no" })
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName("epl")
          .setDescription("Include English Premier League?")
          .addChoices({ name: "Yes", value: "yes" }, { name: "No", value: "no" })
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName("laliga")
          .setDescription("Include La Liga?")
          .addChoices({ name: "Yes", value: "yes" }, { name: "No", value: "no" })
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName("bundesliga")
          .setDescription("Include Bundesliga?")
          .addChoices({ name: "Yes", value: "yes" }, { name: "No", value: "no" })
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName("seriea")
          .setDescription("Include Serie A?")
          .addChoices({ name: "Yes", value: "yes" }, { name: "No", value: "no" })
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName("ucl")
          .setDescription("Include UEFA Champions League?")
          .addChoices({ name: "Yes", value: "yes" }, { name: "No", value: "no" })
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName("mls")
          .setDescription("Include MLS?")
          .addChoices({ name: "Yes", value: "yes" }, { name: "No", value: "no" })
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("status").setDescription("Check sports tracker status and active leagues")
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

  if (sub === "start") {
    if (!settings.channels.sports) {
      await interaction.editReply(
        "No sports channel set! Use `/setchannel sports:#your-channel` first."
      );
      return;
    }
    const interval = interaction.options.getInteger("interval") ?? settings.sportsTracker.intervalMinutes;
    await toggleSportsTracker(interaction.client, true, interval);

    const leagueList = settings.sportsTracker.leagues
      .map((k) => `${LEAGUES[k]?.emoji ?? ""} ${LEAGUES[k]?.name ?? k}`)
      .join(", ");

    const embed = new EmbedBuilder()
      .setColor(0x009c3b)
      .setTitle("📡 Sports Tracker Started!")
      .addFields(
        { name: "Channel", value: `<#${settings.channels.sports}>`, inline: true },
        { name: "Interval", value: `Every ${interval} minute(s)`, inline: true },
        { name: "Leagues", value: leagueList || "None selected", inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
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

  if (sub === "leagues") {
    const allKeys = Object.keys(LEAGUES).filter((k) => k !== "nba2");
    const currentLeagues = new Set(settings.sportsTracker.leagues);

    for (const key of allKeys) {
      const val = interaction.options.getString(key);
      if (val === "yes") currentLeagues.add(key);
      else if (val === "no") currentLeagues.delete(key);
    }

    const newLeagues = [...currentLeagues];
    await toggleSportsTracker(
      interaction.client,
      isSportsTrackerActive(),
      undefined,
      newLeagues
    );

    const leagueList = newLeagues
      .map((k) => `${LEAGUES[k]?.emoji ?? ""} ${LEAGUES[k]?.name ?? k}`)
      .join("\n") || "None";

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("✅ Leagues Updated")
      .addFields({ name: "Active Leagues", value: leagueList })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  if (sub === "status") {
    const active = isSportsTrackerActive();
    const leagues = settings.sportsTracker.leagues;
    const leagueList = leagues
      .map((k) => `${LEAGUES[k]?.emoji ?? ""} ${LEAGUES[k]?.name ?? k}`)
      .join("\n") || "None";

    const embed = new EmbedBuilder()
      .setColor(active ? 0x57f287 : 0xed4245)
      .setTitle("📊 Sports Tracker Status")
      .addFields(
        { name: "Status", value: active ? "🟢 Running" : "🔴 Stopped", inline: true },
        { name: "Channel", value: settings.channels.sports ? `<#${settings.channels.sports}>` : "Not set", inline: true },
        { name: "Interval", value: `${settings.sportsTracker.intervalMinutes} minute(s)`, inline: true },
        { name: "Active Leagues", value: leagueList, inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}
