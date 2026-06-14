// -----------------------------------------------------------------------------
// This file defines what happens after the user triggers the "/report" command.
// Or after the Endtime has been set. 
// This will be the main functionality of the Bot, the time report creation.
// It will be a multi-step conversation that will guide the user through the process of creating a time report.
// Checking every step if the user has provided the correct information and if not, asking them to provide the correct information.
// One Special Feature is how the Activities done are inputted - through voice and transcription + a gpt prompt cleaning it up.
// At the End it will give a quick summary that can then be edited by the user - if everything is correct
// We upload the Information entered to a cloud hosted supabase Database
// -----------------------------------------------------------------------------

//---------------------------------------------------------
// IMPORTING THE DEPENDENCIES
//---------------------------------------------------------

// "Scenes" is Telegraf's toolkit for building multi-step conversations.
const { Scenes } = require('telegraf');

// Our Supabase database client (set up in db.js)
const supabase = require('./db');

// We also need the ChatGPT API for our Transcription and Text Analysis
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

//---------------------------------------------------------
// HELPER FUNCTIONS
//---------------------------------------------------------

// We need to check "does this text look like a valid HH:MM time?" in 2 places
// For this reason i created a function here, that checks whether it matches the format
// To do so, ChatGPT helped me setup a Regex, which is the easiest check for the strings matching 
function isValidTimeFormat(text) {
  const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return timePattern.test(text);
}

// To compare whether the endtime is after the starttime which has to be done to avoid confusing inputs
// this function converts the Time into Minutes since Midnight by multiplying hours * 60 and adding the minutes
// With this we can just do an absolute comparison and see if end is later than start
function timeToMinutesSinceMidnight(timeString) {
  const parts = timeString.split(':');
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  return hours * 60 + minutes;
}

// This Function uses the Input that was given to it and does 2 things with it:
// It first splits different Activities from 1 large string into multiple smaller strings
// And second it does also take the unprofessional input and converts it into professional writing, so we can directly submit it to the Customer!
// It does so by asking ChatGPT API nicely to return the Professional written Activities in a JSON Format so we can directly compute it
// We do some JSON Handling to Parse it and return what we got out of that
// This was done through the use of the ChatGPT Documentation: https://developers.openai.com/api/docs

async function splitIntoProfessionalActivities(rawDescription) {
  const systemPrompt =
    'You are an assistant that turns a worker\'s casual description of their day ' +
    'into a professional work report. Identify each distinct activity mentioned, ' +
    'and rephrase each one in clear, professional language suitable for a formal ' +
    'work report. Respond with ONLY a JSON object of the exact shape ' +
    '{"activities": ["first activity", "second activity"]} — one string per ' +
    'distinct activity, and nothing else before or after the JSON.';

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: rawDescription },
    ],
    response_format: { type: 'json_object' },
  });

  const replyText = completion.choices[0].message.content;
  const parsedReply = JSON.parse(replyText);
  return parsedReply.activities;
}

// Reads the activity description out of a message, which can either be plain
// text or a voice message (which we transcribe with Whisper first).
// Returns the plain text, or null if neither was sent / transcription failed 
// in that case we've already sent the user an explanation, so the calling step
// can just stop (return) without doing anything else.
// This is shared between Step 6 (first time asking) and Step 7 (re-entering
// activities via "5" on the summary screen).
async function getDescriptionFromMessage(ctx) {
  if (ctx.message.voice) {
    // "sendChatAction('typing')" makes Telegram show "Bot is typing..." in the chat. so it doesnt look like a crash
    await ctx.sendChatAction('typing');
    await ctx.reply('🎤 Got your voice message, transcribing...');

    try {
      const fileLink = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
      const response = await fetch(fileLink.href);
      const audioData = await response.arrayBuffer();
      const audioFile = await OpenAI.toFile(Buffer.from(audioData), 'voice-message.ogg');
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
      });
      return transcription.text;
    } catch (err) {
      console.error('Transcription error:', err.message);
      ctx.reply('⚠️ Could not transcribe your voice message. Please try again or type your description instead.');
      return null;
    }
  }

  if (ctx.message.text) {
    return ctx.message.text;
  }

  ctx.reply('⚠️ Please send your description as text or as a voice message.');
  return null;
}

// This Function will create a Summary of the Report after the entire process is done 
// It will display all the Information (as well as the Duration between the Start and Endtime)
// Furthermore it will do a loop to show all Activities that have been recorder - only if some were detected, otherwise it shows that none have been detected
function buildSummaryText(state) {
  const durationMins = timeToMinutesSinceMidnight(state.endTime) - timeToMinutesSinceMidnight(state.startTime);
  const hours   = Math.floor(durationMins / 60);
  const minutes = durationMins % 60;
  const durationText = minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;

  // Build a numbered list of activities using a simple for-loop.
  // We start with an empty text and add one line per activity.
  let activityLines = '';
  if (state.activities.length === 0) {
    activityLines = '   ⚠️ No activities detected.\n';
  } else {
    for (let i = 0; i < state.activities.length; i++) {
      activityLines += `   ${i + 1}. ${state.activities[i]}\n`;
    }
  }

  return (
    `📋 Summary\n\n` +
    `1️⃣  Project:     ${state.projectName}\n` +
    `2️⃣  Start:       ${state.startTime}\n` +
    `3️⃣  End:         ${state.endTime} (${durationText})\n` +
    `4️⃣  Name:        ${state.employeeName}\n` +
    `5️⃣  Activities:\n${activityLines}`
  );
}

// Here we do a Function that just sends the summary and asks if we want to change something
// It needs to be async so it arrives in the right order
// ChatGPT helped with this because it looked bad when testing otherwise
async function sendSummaryAndAsk(ctx) {
  await ctx.reply(buildSummaryText(ctx.wizard.state));
  await ctx.reply('✏️ Would you like to change anything?\nReply with a number (1-5) to re-enter that field, or type confirm.');
}

// With this reportwizard Scene we can handle the multi-step conversation and the state of the conversation. More Info on how it works is on the telegraf documentation.
// Every Step can be defined by itself and we can jump into the next step, once it has been answered, then we can handle the answer and continue
// Each Step is described with a Comment
// The Quickmode thing is for the start and endtime commands which can be used to skip typing the times but rather
// Just typing /startnow and /endnow to automatically detect the time
// But for this we don't want to show the numbers because they wouldn't fit as there's less questions now (no start/endtime question)


const reportWizard = new Scenes.WizardScene(
  'report-wizard',

  // STEP 1: Asking for the Project Name
  // Also we determine if we're in the Quickmode, which is the case when either Start or Endtime has been filled out with the /startnow or /endnow commands
  // It prints the Question Number  in Normal Mode, otherwise it doesn't

  (ctx) => {
    let isQuickMode = false;
    if (ctx.session.prefilledStartTime || ctx.session.prefilledEndTime) {
      isQuickMode = true;
    }

    if (isQuickMode) {
      ctx.reply('📋 What is the name of the project?');
    } else {
      ctx.reply('📋 Question 1/5\nWhat is the name of the project?\n\n(tip: send /cancel at any time to abort)');
    }
    return ctx.wizard.next();
  },

  // STEP 2: This runs when the user replies with the project name.
  // ctx.wizard.state is used to handle the responses and save them in variables that can be used later
  // In this Step we ask for the Time that the Worker has started his shift at the Project
  // If the user used /startnow and /endnow beforehand, we skip the time questions entirely.

  (ctx) => {
    const projectName = ctx.message.text;
    ctx.wizard.state.projectName = projectName;

    // If the "QuickMode" is used, we just skip the next 2 questions and fill in the variables with the messages that come prefilled
    // Also we reset the Start and Endtime
    if (ctx.session.prefilledStartTime && ctx.session.prefilledEndTime) {
      ctx.wizard.state.startTime   = ctx.session.prefilledStartTime;
      ctx.wizard.state.endTime     = ctx.session.prefilledEndTime;
      ctx.wizard.state.isQuickMode = true;
      ctx.session.prefilledStartTime = null;
      ctx.session.prefilledEndTime   = null;

      ctx.reply(
        `⚡ Using recorded times: ${ctx.wizard.state.startTime} → ${ctx.wizard.state.endTime}\n\n` +
        `🙋 What is your name?`
      );
      
      // Otherwise, we use the prebuilt skip command and select the fourth Step, where we don't ask for any number
      return ctx.wizard.selectStep(4);
    }

    // If the "Quickmode" is used we must still check a specialty case
    // If he only typed in the Startnow Command and didnt finish it but rather typed /report after
    // We only use the StartTime and skip to Step 3, not 4 so you can still fill in the endtime
    // Again resetting after
    if (ctx.session.prefilledStartTime) {
      ctx.wizard.state.startTime   = ctx.session.prefilledStartTime;
      ctx.wizard.state.isQuickMode = true;
      ctx.session.prefilledStartTime = null;

      ctx.reply(
        `⚡ Using recorded start time: ${ctx.wizard.state.startTime}\n\n` +
        `🕐 What time did you finish? (HH:MM)`
      );
      return ctx.wizard.selectStep(3);
    }


    // If we use the normal Path without "Quickmode", we just ask the normal Question when he started
    // Also for convenience we tell him what the time is right now for better orientation
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const formattedTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    ctx.reply(
      `🗓 ${formattedDate} — currently it's 🕐 ${formattedTime}\n\n` +
      `⏰ Question 2/5\nWhat time did you start working on "${projectName}"? (HH:MM, e.g. 14:30)`
    );

    return ctx.wizard.next();
  },


  // STEP 3: This runs when the user replies with their start time. Independently of what exactly he writes
  // It will check whether the Time matches our Input Constraints using our "isValidTimeFormat" helper we defined above
  // We only move on to the next step once the input is valid — until then we keep asking again.
  (ctx) => {
    const startTime = ctx.message.text;

    if (!isValidTimeFormat(startTime)) {
      ctx.reply('⚠️ Not a valid time. Please use the 24-hour format HH:MM, e.g. 09:15 or 14:30.');
      return;
    }

    ctx.wizard.state.startTime = startTime;
    ctx.reply('🕐 Question 3/5\nWhat time did you finish working today? (HH:MM)');

    return ctx.wizard.next();
  },

  // STEP 4: This runs when the user replies with their end time.
  // Same validation logic as Step 3, we reuse our helper function instead of repeating the check.
  // Also we do a quick If-Check to see whether the Endtime is after the StartTime to ignore Errors
  // For this we use the timetoMinutessinceMidnight function defined above
  (ctx) => {
    const endTime = ctx.message.text;

    if (!isValidTimeFormat(endTime)) {
      ctx.reply('⚠️ Not a valid time. Please use the 24-hour format HH:MM, e.g. 09:15 or 14:30.');
      return;
    }
    const startMinutes = timeToMinutesSinceMidnight(ctx.wizard.state.startTime);
    const endMinutes = timeToMinutesSinceMidnight(endTime);

    if (endMinutes <= startMinutes) {
      ctx.reply(`⚠️ ${endTime} is not after your start time (${ctx.wizard.state.startTime}). Please enter a later end time.`);
      return;
    }

    ctx.wizard.state.endTime = endTime;
    ctx.reply(ctx.wizard.state.isQuickMode ? '🙋 What is your name?' : '🙋 Question 4/5\nWhat is your name?');

    return ctx.wizard.next();
  },

  // STEP 5: This runs when the user replies with their name.
  // We ask what Activities he has done today and tell him to either send a voice message or type it out
  (ctx) => {
    const employeeName = ctx.message.text;

    ctx.wizard.state.employeeName = employeeName;
    ctx.reply(
      ctx.wizard.state.isQuickMode
        ? '🛠 What did you work on today?\nType a description or send a 🎤 voice message — I\'ll clean it up for you automatically.'
        : '🛠 Question 5/5\nWhat did you work on today?\nType a description or send a 🎤 voice message — I\'ll clean it up for you automatically.'
    );

    return ctx.wizard.next();
  },

  // STEP 6: Now we received the Acticity the worker has performed, either through Voice Message or through Chat.
  // In the Next Step we need to check whether the response sent was a voice message or a Text and Handle it accordingly
  // We will first transcribe or read in the message and then use a quick ChatGPT API Call to Improve Writing and Structural Form, so that we can better save it later on

  async (ctx) => {
    // Get the plain text description, transcribing it first if it was a voice message.
    // getDescriptionFromMessage() already sends an explanation if neither was sent,

    const rawDescription = await getDescriptionFromMessage(ctx);
    if (rawDescription === null) return;

    // Now that we have a plain text description (from either source),
    // we ask GPT to clean it up and split it into individual professional activities.
    // We send a quick heads-up again on what's happening
    await ctx.sendChatAction('typing');
    await ctx.reply('⏳ Analyzing your description...');

    let activities;

    // And try to do a quick API Call again here using the function defined above 
    // If it fails, we show a messaage!
    try {
      activities = await splitIntoProfessionalActivities(rawDescription);
    } catch (err) {
      console.error('GPT error:', err.message);
      ctx.reply('⚠️ Could not analyze your description. Please try again.');
      return;
    }

    // And then we save it into the activities variable
    ctx.wizard.state.rawDescription = rawDescription;
    ctx.wizard.state.activities = activities;

    // Now we send the Summary with the Summary Function which also asks if everything is correct.
    await sendSummaryAndAsk(ctx);
    return ctx.wizard.next();
  },

  // STEP 7: Handles the user's response to the summary.
  // The user can either type "confirm" to finish, or a number (1–5) to re-enter that field.
  // If they chose to edit a field, we ask the question again and STAY on this step until
  // they confirm. We track which field is being edited via ctx.wizard.state.editingQuestion.
  
  async (ctx) => {
    const input = ctx.message?.text?.trim();

    // First we handle what happens when we're editing a question right now
    // We save the question that's being edited in the variable editingquestion


    // Depending on what question we're editing, we are verifying the input just as above
    // ProjectName doesn't need Verification
    // Start and Endtime use again the Valid Time Check + End after Start Check
    // EmployeeName doesn't need Verification
    // For the Activities we again use the Function to Transcribe and Analyze

    if (ctx.wizard.state.editingQuestion != null) {
      const q = ctx.wizard.state.editingQuestion;
      if (q === 1) {
        ctx.wizard.state.projectName = input;

      } else if (q === 2) {
        if (!isValidTimeFormat(input)) {
          ctx.reply('⚠️ Not a valid time. Use HH:MM, e.g. 09:15.');
          return;
        }
        // If we change the start time, make sure it still comes before the stored end time.
        const newStartMins = timeToMinutesSinceMidnight(input);
        const endMins = timeToMinutesSinceMidnight(ctx.wizard.state.endTime);
        if (endMins <= newStartMins) {
          ctx.reply(`⚠️ ${input} is not before your end time (${ctx.wizard.state.endTime}). Enter an earlier start time.`);
          return;
        }
        ctx.wizard.state.startTime = input;

      } else if (q === 3) {
        if (!isValidTimeFormat(input)) {
          ctx.reply('⚠️ Not a valid time. Use HH:MM, e.g. 09:15.');
          return;
        }
        const startMins = timeToMinutesSinceMidnight(ctx.wizard.state.startTime);
        const newEndMins = timeToMinutesSinceMidnight(input);
        if (newEndMins <= startMins) {
          ctx.reply(`⚠️ ${input} is not after your start time (${ctx.wizard.state.startTime}). Enter a later end time.`);
          return;
        }
        ctx.wizard.state.endTime = input;

      } else if (q === 4) {
        ctx.wizard.state.employeeName = input;

      } else if (q === 5) {
        const rawDescription = await getDescriptionFromMessage(ctx);
        if (rawDescription === null) return;

        await ctx.sendChatAction('typing');
        await ctx.reply('⏳ Analyzing your description...');
        try {
          const newActivities = await splitIntoProfessionalActivities(rawDescription);
          ctx.wizard.state.activities = newActivities;
        } catch (err) {
          console.error('GPT error:', err.message);
          ctx.reply('⚠️ Could not analyze your description. Please try again.');
          return;
        }
      }

      // After having done that we save the new Summary and Send it + we reset the editingQuestion
      ctx.wizard.state.editingQuestion = null;
      await sendSummaryAndAsk(ctx);
      return; // stay on this step
    }

    // Now we do the saving Logic and use the supabase client to upload it to there
    // This happens when a user types confirm
    // We first create a little record that includes everything we want to upload
    // "new Date().toISOString().split('T')[0]" gives us today's date as
    // "YYYY-MM-DD" (e.g. "2026-06-09"), which is what Supabase's date column expects.
    // This was done by CHATGPT (the little split function so supabase accepts it)
    if (input?.toLowerCase() === 'confirm' || input?.toLowerCase() === 'yes') {
      const record = {
        project_name:  ctx.wizard.state.projectName,
        start_time:    ctx.wizard.state.startTime,
        end_time:      ctx.wizard.state.endTime,
        employee_name: ctx.wizard.state.employeeName,
        activities:    JSON.stringify(ctx.wizard.state.activities),
        date:          new Date().toISOString().split('T')[0],
      };

      // We Insert the Record into the Supabase Table "reports" just like with SQL
      const { error } = await supabase.from('reports').insert(record);

      // And if the response exists (error) - then we send an error message instead of crashing
      if (error) {
        console.error('Supabase insert error:', error.message);
        ctx.reply('⚠️ Something went wrong while saving the report. Please try again.');
        return;
      }

      // If this isn't the case, we send a Success Message
      ctx.reply('✅ Report saved successfully!');
      return ctx.scene.leave();
    }


    // This is actually the Main Part of this Step, where we asked which Number he wanted to edit
    // We check whether the Question exists and then reask the question (Putting the Questions into an Array so we can easier ask)
    const questionNumber = Number(input);
    if (Number.isInteger(questionNumber) && questionNumber >= 1 && questionNumber <= 5) {
      ctx.wizard.state.editingQuestion = questionNumber;
      const reaskMessages = [
        null,
        '📋 Question 1/5\nWhat is the name of the project?',
        `⏰ Question 2/5\nWhat time did you start working? (HH:MM)`,
        '🕐 Question 3/5\nWhat time did you finish working? (HH:MM)',
        '🙋 Question 4/5\nWhat is your name?',
        '🛠 Question 5/5\nWhat did you work on today? Type it out or send a voice message.',
      ];
      ctx.reply(reaskMessages[questionNumber]);
      return; // To stay on this step
    }

    // If it didn't work:
    ctx.reply('⚠️ Reply with a number (1–5) to change a field, or type yes / confirm to submit.');
  }
);

// When the user is inside the wizard, the scene intercepts ALL messages — including
// commands. So we register /cancel directly on the scene to make sure it works
// even mid-conversation. Without this, the global bot.command('cancel') in index.js
// would never be reached while the wizard is active.
// Just repeating the globally set command here so it also works inside
// Found this solution on StackOVerflow, because it was annoying how it didn't work at first
reportWizard.command('cancel', (ctx) => {
  ctx.reply('❌ Report cancelled. Send /report to start a new one.');
  return ctx.scene.leave();
});


// This was needed to make the Cancelling Command work, it checks whether we're already in the step and the message starts with a /
// to differ between "cancel" and /cancel

// But this was done with ChatGPT 
reportWizard.use((ctx, next) => {
  if (ctx.message?.text?.startsWith('/') && ctx.wizard.cursor > 0) {
    return ctx.reply('⚠️ You are currently filling out a report.\nSend /cancel to abort it first.');
  }
  return next();
});

// We export the finished scene so that "index.js" can import and register it, as mentioned it is to unclutter the code.
module.exports = reportWizard;
