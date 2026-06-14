// -----------------------------------------------------------------------------
// This file is the main entry point for our Bot. It is responsible for
// initializing the Bot and starting the Bot.
// -----------------------------------------------------------------------------

//---------------------------------------------------------
// IMPORTING THE DEPENDENCIES
//---------------------------------------------------------

// The Dotenv package is used to load the environment variables from the .env file (The Secret Tokens!)
require('dotenv').config();

// The Telegraf package and message is used to create the Bot and handle the Telegram API.
// "Scenes" lets us build multi-step conversations, "session" lets the Bot remember
// things between messages (e.g. "which step is this user currently on?").
const { Telegraf, Scenes, session } = require('telegraf');

// Importing our own file that defines the "/report" question flow that will be the main functionality of the Bot.
// This is mainly for a better overview, so not everything is within this file.
const reportWizard = require('./reportWizard');

//---------------------------------------------------------
// INITIALIZING THE BOT
// How to do: https://telegraf.js.org (Telegraf Documentation)
//---------------------------------------------------------

// We create The Bot and pass it the secret Telegram Bot Token.

const bot = new Telegraf(process.env.BOT_TOKEN);

//---------------------------------------------------------
// SETTING UP MULTI-STEP CONVERSATIONS (Scenes)
//---------------------------------------------------------

// The following lines are used to setup the multi-step conversations (Scenes) and register the reportWizard scene.
// We need that so the Bot can remember the state of the conversation and continue from where it left off and handle Multi-Step Conversations.
// How to do so also found in Telegraf Docs

bot.use(session());
const stage = new Scenes.Stage([reportWizard]);
bot.use(stage.middleware());

//---------------------------------------------------------
// FUNCTIONALITY OF THE BOT
//---------------------------------------------------------

// Telegram Bots work by responding to commands and messages.
// Commands are prefixed with a slash (/) and are used to trigger specific actions.
// The Start Command is used to trigger the welcome message, we reply by a guide on how the bot works.

bot.start((ctx) => {
  ctx.reply(
    '👷 HSG Coding Bot\n\n' +
    'I help construction workers log their daily time reports.\n\n' +
    '⏰ /startnow — stamp your start time\n' +
    '🏁 /endnow  — stamp your end time & start report\n' +
    '📋 /report  — start a report manually\n' +
    '❌ /cancel  — cancel an ongoing report'
  );
});

// "bot.help" runs whenever a user sends the "/help" command.
bot.help((ctx) => {
  ctx.reply(
    'Available commands:\n\n' +
    '📋 /report — start a new time report\n' +
    '⏰ /startnow — stamp your start time\n' +
    '🏁 /endnow  — stamp your end time & start report\n' +
    '❌ /cancel — cancel the current report at any point'
  );
});

// "/cancel" lets the user abort the report wizard at any point.
// We do this by just leaving the scene, which is a prebuilt command by Telegraf
bot.command('cancel', (ctx) => {
  ctx.scene.leave();
  ctx.reply('❌ Report cancelled. Send /report to start a new one.');
});

// "/startnow" stamps the current time as the start of a shift.
// It just takes the current time in a variable called time and only saves the hour and the minutes, not the date or other stuff
// We put this information into a help variable called prefilledStartTime
bot.command('startnow', (ctx) => {
  const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  ctx.session.prefilledStartTime = time;
  ctx.reply(`⏰ Start time recorded: ${time}\nSend /endnow when you're done.`);
});

// "/endnow" stamps the current time as the end of the shift and jumps straight into the report wizard.
// If no start time was recorded yet (The Variable defined above isn't set yet), we warn the user instead.
// We record the EndTime exactly like the Start Time into another Variable
// We do async here, so it doesn't send it in the wrong order which would make it confusing to the user
// If everything went right, we enter the "report-wizard scene", which is everything defined in the reportwizard.js file
bot.command('endnow', async (ctx) => {
  if (!ctx.session.prefilledStartTime) {
    ctx.reply('⚠️ No start time recorded yet. Send /startnow first.');
    return;
  }
  const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  ctx.session.prefilledEndTime = time;
  await ctx.reply(`🏁 End time recorded: ${time}\n\nStarting your report...`);
  ctx.scene.enter('report-wizard');
});

// The Command "/report" is used to trigger the main functionality of the Bot, the time report creation. It will start the reportWizard scene that is defined in the reportWizard.js file.
bot.command('report', (ctx) => {
  ctx.scene.enter('report-wizard');
});

//---------------------------------------------------------
// LAUNCHING THE BOT
//---------------------------------------------------------

// "bot.launch()" connects to Telegram's servers and starts listening for messages.
// From then on the Commands above will work within Telegram!
// We also give a short Console Log, so we know it worked
bot.launch();
console.log('The HSG Coding Telegram Bot was successfully started and is now running!');

//---------------------------------------------------------
// SHUTDOWN (stopping the Bot cleanly)
//---------------------------------------------------------

// These two Lines are just copied from the Docs, which explained Bot Setup and Deployment. They make sure that when we stop the program (e.g. with Ctrl+C in the terminal), the Bot disconnects from Telegram properly instead of just being cut off abruptly.

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
