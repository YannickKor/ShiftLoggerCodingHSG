// -----------------------------------------------------------------------------
// This file sets up the connection to our Supabase database.
// We keep it in a separate file so changes can be made easier
// Documentation for how this is done was found here: https://supabase.com/docs/reference/javascript/v1
// I used Supabase before to do some other stuff and as it has a free plan i decided to go for it here as well
// Basically it's just the connection Template here
// -----------------------------------------------------------------------------

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

module.exports = supabase;
