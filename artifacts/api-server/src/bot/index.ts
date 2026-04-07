import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
} from "discord.js";
import { logger } from "../lib/logger.js";
import { loadSettings } from "./store.js";
import { handleMessageCreate } from "./events/messageCreate.js";
import { handleInteractionCreate } from "./events/interactionCreate.js";
import { initMemeSpam } from "./memeSpammer.js";
import { initSportsTracker } from "./sportsTracker.js";
import * as ping from "./commands/ping.js";
import * as moderation from "./commands/moderation.js";
import * as setchannel from "./commands/setchannel.js";
import * as announce from "./commands/announce.js";
import * as setrules from "./commands/setrules.js";
import * as memespam from "./commands/memespam.js";
import * as sports from "./commands/sports.js";

const COMMANDS = [
  ping.data,
  moderation.data,
  setchannel.data,
  announce.data,
  setrules.data,
  memespam.data,
  sports.data,
];

export async function startBot(): Promise<void> {
  const token = process.env["DISCORD_BOT_TOKEN"];
  if (!token) {
    logger.error("DISCORD_BOT_TOKEN is not set — bot will not start");
    return;
  }

  await loadSettings();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Message, Partials.Channel],
  });

  client.once("ready", async (c) => {
    logger.info({ tag: c.user.tag }, "Discord bot is ready");

    const rest = new REST().setToken(token);
    try {
      const commandData = COMMANDS.map((cmd) => cmd.toJSON());
      await rest.put(Routes.applicationCommands(c.user.id), { body: commandData });
      logger.info({ count: commandData.length }, "Slash commands registered globally");
    } catch (err) {
      logger.error({ err }, "Failed to register slash commands");
    }

    await initMemeSpam(client);
    await initSportsTracker(client);
  });

  client.on("messageCreate", (message) => {
    handleMessageCreate(message).catch((err: unknown) =>
      logger.error({ err }, "messageCreate error")
    );
  });

  client.on("interactionCreate", (interaction) => {
    handleInteractionCreate(interaction).catch((err: unknown) =>
      logger.error({ err }, "interactionCreate error")
    );
  });

  client.on("error", (err) => {
    logger.error({ err }, "Discord client error");
  });

  await client.login(token);
}
