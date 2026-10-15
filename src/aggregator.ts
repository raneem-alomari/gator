import { getNextFeedToFetch, markFeedFetched } from "./lib/db/queries/feeds.js";
import { createPost } from "./lib/db/queries/posts.js";
import { fetchFeed } from "./rss.js";

export function parseDuration(durationStr: string): number {
  const regex = /^(\d+)(ms|s|m|h)$/;
  const match = durationStr.match(regex);

  if (!match) {
    throw new Error(
      "Invalid duration. Use a number followed by ms, s, m, or h (for example: 500ms, 1s, 1m, 1h).",
    );
  }

  const amount = Number(match[1]);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
  };

  const milliseconds = amount * multipliers[unit];

  if (!Number.isSafeInteger(milliseconds) || milliseconds <= 0) {
    throw new Error("Duration must be a positive, valid number of milliseconds.");
  }

  return milliseconds;
}

export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) return `${milliseconds}ms`;

  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h${minutes % 60}m${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export async function scrapeFeeds(): Promise<void> {
  const feed = await getNextFeedToFetch();

  if (!feed) {
    console.log("No feeds available to fetch.");
    return;
  }

  await markFeedFetched(feed.id);
  console.log(`Fetching feed: ${feed.name}`);

  const rssFeed = await fetchFeed(feed.url);

  for (const item of rssFeed.channel.item) {
    const publishedAt = item.pubDate ? new Date(item.pubDate) : null;
    const validPublishedAt =
      publishedAt && !Number.isNaN(publishedAt.getTime())
        ? publishedAt
        : null;

    await createPost(
      item.title,
      item.link,
      item.description || null,
      validPublishedAt,
      feed.id,
    );
  }

  console.log(`Feed fetched successfully: ${feed.name}`);
}
