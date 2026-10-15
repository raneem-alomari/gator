import { getFeeds } from "./lib/db/queries/feeds.js";
import { createFeedFollow, getFeedFollowsForUser, deleteFeedFollow } from "./lib/db/queries/feed_follows.js";
import { getFeedByURL } from "./lib/db/queries/feeds.js";
import { getPostsForUser } from "./lib/db/queries/posts.js";
import type { Feed, User } from "./lib/db/schema.js";
import { createFeed } from "./lib/db/queries/feeds.js";
import { scrapeFeeds, parseDuration, formatDuration } from "./aggregator.js";
import { readConfig, setUser } from "./config.js";
import {
  createUser,
  getUserByName,
  deleteAllUsers,
  getUsers,
} from "./lib/db/queries/users.js";

type CommandHandler = (
  cmdName: string,
  ...args: string[]
) => Promise<void>;

type CommandsRegistry = Record<string, CommandHandler>;

async function handlerLogin(
  cmdName: string,
  ...args: string[]
): Promise<void> {
  if (args.length === 0) {
    throw new Error("username is required");
  }

  const username = args[0];
  const user = await getUserByName(username);

  if (!user) {
    throw new Error(`User "${username}" does not exist`);
  }

  setUser(username);
  console.log(`User has been set to ${username}`);
}

async function handlerRegister(
  cmdName: string,
  ...args: string[]
): Promise<void> {
  if (args.length === 0) {
    throw new Error("username is required");
  }

  const username = args[0];
  const existingUser = await getUserByName(username);

  if (existingUser) {
    throw new Error(`User "${username}" already exists`);
  }

  const user = await createUser(username);
  setUser(username);

  console.log(`User "${username}" was created successfully`);
  console.log(user);
}

async function handlerReset(
  cmdName: string,
  ...args: string[]
): Promise<void> {
  await deleteAllUsers();
  console.log("Database reset successfully");
}

async function handlerUsers(
  cmdName: string,
  ...args: string[]
): Promise<void> {
  const users = await getUsers();
  const config = readConfig();

  for (const user of users) {
    const current = user.name === config.currentUserName;
    console.log(`* ${user.name}${current ? " (current)" : ""}`);
  }
}


async function handlerAgg(
  cmdName: string,
  ...args: string[]
): Promise<void> {
  if (args.length !== 1) {
    throw new Error("Usage: agg <time_between_reqs>");
  }

  const timeBetweenRequests = parseDuration(args[0]);
  console.log(`Collecting feeds every ${formatDuration(timeBetweenRequests)}`);

  const handleError = (error: unknown) => {
    console.error("Error scraping feeds:", error instanceof Error ? error.message : error);
  };

  // Start immediately, then continue at the requested interval.
  void scrapeFeeds().catch(handleError);

  const interval = setInterval(() => {
    void scrapeFeeds().catch(handleError);
  }, timeBetweenRequests);

  await new Promise<void>((resolve) => {
    process.once("SIGINT", () => {
      console.log("\\nShutting down feed aggregator...");
      clearInterval(interval);
      resolve();
    });
  });
}

async function handlerBrowse(
  cmdName: string,
  user: User,
  ...args: string[]
): Promise<void> {
  if (args.length > 1) {
    throw new Error("Usage: browse [limit]");
  }

  const limit = args.length === 0 ? 2 : Number(args[0]);

  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new Error("The limit must be a positive integer.");
  }

  const posts = await getPostsForUser(user.id, limit);

  if (posts.length === 0) {
    console.log("No posts found. Run agg to fetch posts, or follow a feed.");
    return;
  }

  for (const post of posts) {
    console.log(`Title: ${post.title}`);
    console.log(`URL: ${post.url}`);
    console.log(`Feed: ${post.feedName}`);
    console.log(
      `Published: ${post.publishedAt ? post.publishedAt.toISOString() : "Unknown"}`,
    );
    if (post.description) {
      console.log(`Description: ${post.description}`);
    }
    console.log("");
  }
}

function printFeed(feed: Feed, user: User): void {
  console.log("Feed:");
  console.log(`  ID: ${feed.id}`);
  console.log(`  Name: ${feed.name}`);
  console.log(`  URL: ${feed.url}`);
  console.log(`  User ID: ${feed.userId}`);
  console.log(`  Created: ${feed.createdAt}`);
  console.log(`  Updated: ${feed.updatedAt}`);

  console.log("Added by:");
  console.log(`  ID: ${user.id}`);
  console.log(`  Name: ${user.name}`);
}


type UserCommandHandler = (
  cmdName: string,
  user: User,
  ...args: string[]
) => Promise<void>;

const middlewareLoggedIn = (handler: UserCommandHandler): CommandHandler => {
  return async (cmdName: string, ...args: string[]): Promise<void> => {
    const userName = readConfig().currentUserName;
    if (!userName) {
      throw new Error("You must log in before running this command");
    }

    const user = await getUserByName(userName);
    if (!user) {
      throw new Error(`User ${userName} not found`);
    }

    await handler(cmdName, user, ...args);
  };
};

async function handlerAddFeed(
  cmdName: string,
  user: User,
  ...args: string[]
): Promise<void> {
  if (args.length < 2) throw new Error("Usage: addfeed <name> <url>");

  const feed = await createFeed(args[0], args[1], user.id);
  const follow = await createFeedFollow(user.id, feed.id);
  printFeed(feed, user);
  console.log(`${follow.userName} is now following "${follow.feedName}"`);
}


async function handlerFeeds(
  cmdName: string,
  ...args: string[]
): Promise<void> {
  if (args.length > 0) {
    throw new Error("The feeds command takes no arguments");
  }

  const allFeeds = await getFeeds();

  for (const feed of allFeeds) {
    console.log(`* ${feed.name}`);
    console.log(`  URL: ${feed.url}`);
    console.log(`  Added by: ${feed.userName}`);
  }
}

async function handlerFollow(
  cmdName: string,
  user: User,
  ...args: string[]
): Promise<void> {
  if (args.length !== 1) throw new Error("Usage: follow <url>");

  const feed = await getFeedByURL(args[0]);
  if (!feed) throw new Error(`Feed not found: ${args[0]}`);

  const follow = await createFeedFollow(user.id, feed.id);
  console.log(`${follow.userName} is now following "${follow.feedName}"`);
}

async function handlerUnfollow(
  cmdName: string,
  user: User,
  ...args: string[]
): Promise<void> {
  if (args.length !== 1) throw new Error("Usage: unfollow <url>");

  const feed = await getFeedByURL(args[0]);
  if (!feed) throw new Error(`Feed not found: ${args[0]}`);

  const deletedFollow = await deleteFeedFollow(user.id, feed.id);
  if (!deletedFollow) {
    throw new Error(`${user.name} is not following "${feed.name}"`);
  }

  console.log(`${user.name} unfollowed "${feed.name}"`);
}

async function handlerFollowing(
  cmdName: string,
  user: User,
  ...args: string[]
): Promise<void> {
  if (args.length !== 0) throw new Error("Usage: following");

  const follows = await getFeedFollowsForUser(user.id);
  console.log(`Feeds followed by ${user.name}:`);
  for (const follow of follows) {
    console.log(`* ${follow.feedName}`);
  }
}

function registerCommand(
  registry: CommandsRegistry,
  cmdName: string,
  handler: CommandHandler,
): void {
  registry[cmdName] = handler;
}

async function runCommand(
  registry: CommandsRegistry,
  cmdName: string,
  ...args: string[]
): Promise<void> {
  const handler = registry[cmdName];

  if (!handler) {
    throw new Error(`Unknown command: ${cmdName}`);
  }

  await handler(cmdName, ...args);
}

async function main(): Promise<void> {
  const commandsRegistry: CommandsRegistry = {};

  registerCommand(commandsRegistry, "login", handlerLogin);
  registerCommand(commandsRegistry, "register", handlerRegister);
  registerCommand(commandsRegistry, "reset", handlerReset);
  registerCommand(commandsRegistry, "users", handlerUsers);
  registerCommand(commandsRegistry, "agg", handlerAgg);
  registerCommand(commandsRegistry, "browse", middlewareLoggedIn(handlerBrowse));
registerCommand(commandsRegistry, "addfeed", middlewareLoggedIn(handlerAddFeed));
  registerCommand(commandsRegistry, "feeds", handlerFeeds);
registerCommand(commandsRegistry, "follow", middlewareLoggedIn(handlerFollow));
registerCommand(commandsRegistry, "following", middlewareLoggedIn(handlerFollowing));
  registerCommand(commandsRegistry, "unfollow", middlewareLoggedIn(handlerUnfollow));
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Not enough arguments provided");
    process.exit(1);
  }

  const cmdName = args[0];
  const cmdArgs = args.slice(1);

  try {
    await runCommand(commandsRegistry, cmdName, ...cmdArgs);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  process.exit(0);
}

main();
