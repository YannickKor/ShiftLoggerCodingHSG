/*
----------------------------------------------------
This file is the core piece of the website
It's responsible for querying the Supabase Database and Displaying all of it on the Page
Furthermore it handles the Search Function as well as the Delete and Download Button Call
It uses mainly Bootstrap for Design again, as well as SupabaseJS to query the Database for all the Reports
----------------------------------------------------
*/

// Environmental Variables
// The "KEY" here is safe to use in the Browser as any person allowed to see the Dashboard will have access to the bot anyways
const SUPABASE_URL = 'https://uxlpkilbtfnjfwxybkpt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_no-UvqtbqYT8HMTBny2oIw_yGshIESo';

// Again we need to do some Initialization according to the Docs
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


// Here we Select the Document Item that we'll insert the Cards into later (id = reports)
const reportsContainer = document.getElementById('reports');

// We create an Array that just includes all of the Reports that we will get from the Supabase Query
// It's main Function is for the Download Button later
let allReports = [];

// This is an Array that will be a subset of all Reports, it will only be the ones that match the Search Function
let visibleReports = [];

// This is the Element for the SearchBar
const searchInput = document.getElementById('searchInput');

// We need to do a function to later create cards to show the reports
// But there's a lot of them so its easier done once than each time individually
function buildCard(report, index) {
  const activities = JSON.parse(report.activities);
  let activitiesHtml = '';
  // Creating a List for all the Activities
  for (let i = 0; i < activities.length; i++) {
    activitiesHtml += `<li>${activities[i]}</li>`;
  }


  // We Return a Nice Card in BootStrap Format with all the Information included
  // Also we add to the top right a little X thats placed there with position-absolute at the end-0 (so top right) it triggers the delete function and gives the function
  // The ID of the Report to delete, the function will be defined below
  // Also the Downloading Funtion happens here, we basically give the function all the information from our Report in JSON Form by giving it the contents of the Array of all Visible Reports at the Index (so at the one, we are in right now)
  // The PDF Creation is done in pdf.js

  return `
    <div class="col">
      <div class="card h-100 position-relative">
      
        <button class="btn-close position-absolute top-0 end-0 m-2" aria-label="Delete" onclick="deleteReport(${report.id})"></button>
        <div class="card-body d-flex flex-column">
          <h5 class="card-title">${report.project_name}</h5>
          <h6 class="card-subtitle mb-2 text-muted">${report.date}</h6>
          <p class="card-text">
            🕐 ${report.start_time} - ${report.end_time}<br>
            🙋 ${report.employee_name}
          </p>
          <ul class="card-text">${activitiesHtml}</ul>
          <button class="btn btn-primary mt-auto" onclick="downloadReportPdf(visibleReports[${index}])">Download Report</button>
        </div>
      </div>
    </div>
  `;
}

// Loads all reports from the database and displays them as cards.
// Again to Load Data from SupaBase you best follow the Supabase Docs
// It works kind of like SQL but more Javascript-Like
async function loadReports() {

  reportsContainer.innerHTML = '<p>Loading reports...</p>';

  const { data, error } = await supabaseClient
    .from('reports')
    .select('*')
    .order('date', { ascending: false })
    .order('start_time', { ascending: false });

// Error Handling
  if (error) {
    console.error('Error loading reports:', error.message);
    reportsContainer.innerHTML = '<p>⚠️ Could not load reports.</p>';
    return;
  }

// Here we Store all Information into the Array for the PDF Download Button Later
  allReports = data;

  // This Function will render all reports on the page (see below)
  renderReports(allReports);
}

// Builds the cards for the given list of reports and shows them on the page.
// We give it which reports to render, and it builds them on the page all at once
function renderReports(reports) {
  visibleReports = reports;

  if (reports.length === 0) {
    reportsContainer.innerHTML = '<p>No reports found.</p>';
    return;
  }

// We Build all Cards when the page is load at once so we just build them individually into the variable cardsHTML
// And then we update the page all at once
  let cardsHtml = '';
  for (let i = 0; i < reports.length; i++) {
    cardsHtml += buildCard(reports[i], i);
  }
  reportsContainer.innerHTML = cardsHtml;
}


// Whenever the user types in the search bar, only show reports whose project
// This was done through a Youtube Tutorial 
// Event Listener was copied from here: https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/search_event
// Filter was copied from here: https://www.tutorialspoint.com/article/filter-array-with-filter-and-includes-in-javascript#:~:text=JavaScript%20filter()%20and%20includes,if%20found%20and%20false%20otherwise.
searchInput.addEventListener('input', () => {
  const searchTerm = searchInput.value.toLowerCase();

  const filtered = allReports.filter((report) =>
    report.project_name.toLowerCase().includes(searchTerm)
  );

  // Now of course only rendering the ones in the filtered array, not all
  renderReports(filtered);
});


// To Delete a Report we receive the ID into a Function and do a quick confirmation Box at the Top asking for it
// If not accepted, we don't do it
async function deleteReport(id) {
  const sure = confirm('Delete this report?');
  if (!sure) return;

  // Again a Supabase Command doing the deletion of the Entry where the ID is the ID which we want to delete
  const { error } = await supabaseClient
    .from('reports')
    .delete()
    .eq('id', id);

  // Error Handling
  if (error) {
    console.error('Error deleting report:', error.message);
    alert('⚠️ Could not delete report.');
    return;
  }

  loadReports();
}

// Calling the Function to Start it
loadReports();
