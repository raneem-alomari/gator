import { XMLParser } from "fast-xml-parser";

export type RSSItem = {
  title: string;
  link: string;
  description: string;
  pubDate: string;
};

export type RSSFeed = {
  channel: {
    title: string;
    link: string;
    description: string;
    item: RSSItem[];
  };
};

function getString(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  return value;
}

export async function fetchFeed(feedURL: string): Promise<RSSFeed> {
  const response = await fetch(feedURL, {
    headers: {
      "User-Agent": "gator",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch feed: ${response.status} ${response.statusText}`,
    );
  }

  const xmlData = await response.text();

  const parser = new XMLParser({
    processEntities: false,
  });

  const parsedData = parser.parse(xmlData);
  const channel = parsedData?.rss?.channel;

  if (!channel || typeof channel !== "object") {
    throw new Error("RSS feed is missing its channel");
  }

  const title = getString(channel.title);
  const link = getString(channel.link);
  const description = getString(channel.description);

  if (!title || !link || !description) {
    throw new Error("RSS feed is missing valid channel metadata");
  }

  let items: unknown[] = [];

  if (channel.item !== undefined) {
    if (Array.isArray(channel.item)) {
      items = channel.item;
    } else if (
      typeof channel.item === "object" &&
      channel.item !== null
    ) {
      items = [channel.item];
    }
  }

  const validItems: RSSItem[] = [];

  for (const item of items) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const rssItem = item as Record<string, unknown>;
    const itemTitle = getString(rssItem.title);
    const itemLink = getString(rssItem.link);
    const itemDescription = getString(rssItem.description);
    const pubDate = getString(rssItem.pubDate);

    if (!itemTitle || !itemLink || !itemDescription || !pubDate) {
      continue;
    }

    validItems.push({
      title: itemTitle,
      link: itemLink,
      description: itemDescription,
      pubDate,
    });
  }

  return {
    channel: {
      title,
      link,
      description,
      item: validItems,
    },
  };
}
