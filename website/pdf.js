/* -----------------------------------------------------------------------------
This file builds a simple PDF for one report, using the jsPDF library.
It is called by the "Download Report" button in script.js. Which is in each of the Report Cards
jsPDF is a Library ChatGPT told me to use, the Documentations aren't that good but it's a fairly simple principle
Documentation: https://artskydj.github.io/jsPDF/docs/index.html
----------------------------------------------------------------------------- */

// Basically we just build a Function to create the Report, it's exactly like the Examples in the Documentation
// You create a Document and then just add stuff to it by setting the Font Size and the y-axis place 

function downloadReportPdf(report) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // The activities were saved as a JSON string, so we parse them back into an array.
  const activities = JSON.parse(report.activities);

  // y keeps track of how far down the page we are, so each line gets its own row.
  let y = 20;

  // Little Logo on the Right Top Page
  doc.setFontSize(16);
  doc.text('HSG Coding', 190, y, { align: 'right' });

  // And from here, we just fill out the Information, all from the JSON given to the function (report)
  // It included the Database Request Result for the specific Report
  doc.setFontSize(16);
  doc.text('Time Report', 10, y);

  y += 10;
  doc.setFontSize(12);
  doc.text(`Project: ${report.project_name}`, 10, y);

  y += 8;
  doc.text(`Date: ${report.date}`, 10, y);

  y += 8;
  doc.text(`Time: ${report.start_time} - ${report.end_time}`, 10, y);

  y += 8;
  doc.text(`Name: ${report.employee_name}`, 10, y);

  y += 10;
  doc.text('Activities:', 10, y);

  // For the Activities (Same as before), we need a Loop to go through all
  for (let i = 0; i < activities.length; i++) {
    y += 8;
    doc.text(`- ${activities[i]}`, 14, y);
  }

  // Saves the PDF to the user's downloads folder with a filename that makes sense
  doc.save(`report-${report.project_name}-${report.date}.pdf`);
}
