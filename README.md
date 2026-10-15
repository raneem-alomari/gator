# Gator

Gator is a command-line RSS feed aggregator built with TypeScript and PostgreSQL. It lets users register, add RSS feeds, follow feeds, collect articles, and browse recent posts from the feeds they follow.

## Prerequisites

Before using Gator, make sure you have:

- **Node.js and npm** installed.
- **PostgreSQL** installed and running.
- **Git** installed if you want to clone or contribute to the repository.

## Installation

1. Clone this repository:

   ```bash
   git clone https://github.com/YOUR-USERNAME/gator.git
   cd gator
   ```

   Replace the URL with your actual GitHub repository URL.

2. Install the dependencies:

   ```bash
   npm install
   ```

3. Create the PostgreSQL database if it does not already exist:

   ```bash
   createdb gator
   ```

4. Apply the database migrations:

   ```bash
   npx drizzle-kit migrate
   ```

## Configuration

Gator uses a JSON configuration file at `~/.gatorconfig.json` in your home directory.

Create or edit the file:

```bash
nano ~/.gatorconfig.json
```

Add the following configuration, replacing the database credentials with your own PostgreSQL settings:

```json
{
  "db_url": "postgres://postgres:postgres@localhost:5432/gator?sslmode=disable",
  "current_user_name": ""
}
```

The `db_url` field specifies how Gator connects to PostgreSQL. The `current_user_name` field stores the username currently selected in the CLI.

Keep your actual database credentials private. Do not commit your personal configuration file to the repository.

## Running Gator

Run commands from the project directory using:

```bash
npm run start <command> [arguments]
```

### User commands

Register a new user:

```bash
npm run start register YOUR-USERNAME
```

Log in as an existing user:

```bash
npm run start login YOUR-USERNAME
```

List registered users:

```bash
npm run start users
```

### Feed commands

Add an RSS feed:

```bash
npm run start addfeed "Hacker News RSS" "https://hnrss.org/newest"
```

List available feeds:

```bash
npm run start feeds
```

Follow a feed by its URL:

```bash
npm run start follow "https://hnrss.org/newest"
```

List the feeds followed by the current user:

```bash
npm run start following
```

Unfollow a feed:

```bash
npm run start unfollow "https://hnrss.org/newest"
```

### Aggregation and browsing

Start collecting posts from feeds:

```bash
npm run start agg 10s
```

The duration specifies how often Gator fetches feeds. Supported units include milliseconds (`ms`), seconds (`s`), minutes (`m`), and hours (`h`). Press `Ctrl+C` to stop the aggregator.

Browse the latest two posts from the feeds you follow:

```bash
npm run start browse
```

Specify a custom maximum number of posts:

```bash
npm run start browse 5
```

## Technology Stack

- TypeScript
- Node.js
- PostgreSQL
- Drizzle ORM and Drizzle Kit
- RSS/XML parsing with `fast-xml-parser`

## Notes

- The database must be running before using Gator.
- Users can browse posts only from feeds they follow.
- Run the aggregator to fetch and store articles before browsing.
- RSS feeds may return different article metadata, and publication dates may not always be available.
