# ShiftLoggerHSG

## The Problem

Construction workers are often in a rush. At the end of a long shift, nobody wants to
open a complicated app, log in, and fill out a long form just to report what they did
that day. Most existing time-tracking apps also feel clunky and unfamiliar — yet
another app to install, learn, and remember to open.

But almost everyone already has **Telegram** open and knows how to use a chat.

## The Idea

HSG Coding Bot turns time reporting into a short conversation. The worker just chats
with the bot — stamping their start/end time with one command each, then answering a
few quick questions (or just sending a **voice message** describing what they did).
The bot transcribes the voice message and rewrites the description into clean,
professional language automatically using ChatGPT, then saves everything to a
database. A small web dashboard lets you view, search, delete and download (as PDF)
all submitted reports.

## Tech Stack & Hosting

| Part                  | What we used                                              |
|------------------------|-----------------------------------------------------------|
| Bot framework          | [Telegraf](https://telegraf.js.org) (Node.js)              |
| Voice transcription    | OpenAI Whisper (`whisper-1`)                                |
| Text cleanup           | OpenAI GPT (`gpt-4o-mini`)                                  |
| Database               | [Supabase](https://supabase.com) (Postgres)                |
| Bot hosting            | [Railway](https://railway.app)                              |
| Website / Dashboard    | Bootstrap 5, vanilla JS, [jsPDF](https://github.com/parallax/jsPDF) |

## How to Use the Bot

1. Open Telegram and search for **[@HSGCodingBot](https://t.me/HSGCodingBot)** (or go
   directly to [t.me/HSGCodingBot](https://t.me/HSGCodingBot)).
2. Send `/start` to see the welcome message.
3. Send `/report` to fill out a full time report.

### Commands

| Command      | What it does                                                                 |
|--------------|-------------------------------------------------------------------------------|
| `/start`     | Shows the welcome message and a quick overview of all commands.              |
| `/help`      | Shows the available commands.                                                |
| `/report`    | Starts a new time report from scratch (asks for project, start/end time, your name, and what you worked on). |
| `/startnow`  | Stamps the current time as your **start** time. Use this when you begin a shift. |
| `/endnow`    | Stamps the current time as your **end** time and immediately starts the report (skipping the time questions, since they're already filled in). |
| `/cancel`    | Cancels a report that is currently in progress.                              |

While filling out a report, the last question ("What did you work on today?") can be
answered either by **typing** a description or sending a **voice message** — the bot
transcribes it and rewrites it into a professional summary automatically. Before
saving, you'll see a summary and can type a number (1–5) to edit any field, or
`confirm`/`yes` to save it.

## The Website

All submitted reports can be viewed at **[ykoros.de](https://ykoros.de)** — a simple
dashboard showing every report as a card (project, date, time, name, activities),
with a search bar, a delete button, and a "Download Report" button that generates a
PDF.

## Hosting Status

This project is hosted on **Railway's $5 free trial credit** (for the bot) and
**$5 of OpenAI credits** (for transcription/text cleanup). I'll check daily that
everything is still running until grading is complete. If something doesn't work,
please email me at **korosyannick@gmail.com**.

## Running It Yourself

If you want to run your own copy of this bot:

1. **Clone this repository** and run `npm install`.

2. **Create a `.env` file** in the project root with the following keys:

   ```env
   # Get this from @BotFather on Telegram (create a new bot with /newbot)
   BOT_TOKEN=your_telegram_bot_token

   # Get this from https://platform.openai.com/api-keys
   OPENAI_API_KEY=your_openai_api_key

   # Get these from your Supabase project: Settings -> API
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_KEY=your_supabase_publishable_key
   ```

3. **Set up the database**: in your Supabase project, create a table called
   `reports` with the following columns:

   | Column          | Type      |
   |------------------|-----------|
   | `id`             | `int8` (auto, primary key) |
   | `project_name`   | `text`    |
   | `start_time`     | `text`    |
   | `end_time`       | `text`    |
   | `employee_name`  | `text`    |
   | `activities`     | `text`    |
   | `date`           | `date`    |

4. **Start the bot**: `npm start`

5. (Optional) **Host the website**: the `website/` folder is a static site —
   upload it to any static host (e.g. your own domain, GitHub Pages, etc.) and
   update the `SUPABASE_URL` / `SUPABASE_KEY` in `website/script.js` to match your
   own Supabase project.

---

<sub><i>This README was drafted with the help of ChatGPT. A couple of code sections also used ChatGPT as a fallback (where I knew a faster approach existed but wasn't yet confident implementing it myself), these sections are marked inline by a comment.</i></sub>
