import http from "node:http";

import {
  results,
  totalProcessed,
  recovered,
  blocked,
  escalated,
  amountRecovered,
  totalAtRisk,
  recoveryRate,
} from "./batch.js";

const PORT = 3000;

const report = {
  totalProcessed,
  recovered: recovered.length,
  blocked: blocked.length,
  escalated: escalated.length,
  amountRecovered,
  totalAtRisk,
  recoveryRate,
  results,
};

const dashboardHtml = `
<!DOCTYPE html>
<html lang="en">

<head>

  <meta charset="UTF-8" />

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />

  <title>RecoverAI</title>

  <style>

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: #f5f7fb;
      color: #172033;
    }

    .container {
      max-width: 1200px;
      margin: auto;
      padding: 40px 24px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
      gap: 20px;
    }

    .header h1 {
      margin: 0;
      font-size: 36px;
    }

    .header p {
      color: #687386;
      margin-top: 8px;
    }

    button {
      border: none;
      border-radius: 10px;
      padding: 14px 22px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      background: #172033;
      color: white;
    }

    button:hover {
      opacity: 0.9;
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .status {
      display: none;
      background: white;
      border-radius: 14px;
      padding: 20px 24px;
      margin-bottom: 24px;
      box-shadow: 0 4px 18px rgba(0,0,0,0.06);
    }

    .status-title {
      font-weight: 700;
      margin-bottom: 10px;
    }

    .activity {
      color: #687386;
      line-height: 1.8;
    }

    .metrics {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 18px;
      margin-bottom: 18px;
    }

    .small-metrics {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 18px;
      margin-bottom: 30px;
    }

    .card {
      background: white;
      border-radius: 14px;
      padding: 24px;
      box-shadow: 0 4px 18px rgba(0,0,0,0.06);
    }

    .label {
      color: #687386;
      font-size: 14px;
      margin-bottom: 10px;
    }

    .value {
      font-size: 30px;
      font-weight: 700;
    }

    .section {
      background: white;
      border-radius: 14px;
      padding: 24px;
      box-shadow: 0 4px 18px rgba(0,0,0,0.06);
    }

    .section h2 {
      margin-top: 0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th,
    td {
      text-align: left;
      padding: 14px 10px;
      border-bottom: 1px solid #edf0f5;
    }

    th {
      color: #687386;
      font-size: 13px;
    }

    .recovered {
      font-weight: 700;
    }

    .escalated {
      font-weight: 700;
    }

    .blocked {
      font-weight: 700;
    }

    @media (max-width: 800px) {

      .header {
        flex-direction: column;
        align-items: flex-start;
      }

      .metrics,
      .small-metrics {
        grid-template-columns: 1fr;
      }

    }

  </style>

</head>

<body>

  <div class="container">

    <div class="header">

      <div>
        <h1>RecoverAI</h1>
        <p>AI Revenue Recovery Agent</p>
      </div>

      <button id="runButton">
        Run Recovery
      </button>

    </div>


    <div id="status" class="status">

      <div class="status-title">
        RecoverAI Agent Activity
      </div>

      <div id="activity" class="activity"></div>

    </div>


    <div class="metrics">

      <div class="card">

        <div class="label">
          Revenue At Risk
        </div>

        <div class="value">
          ₹${totalAtRisk.toLocaleString("en-IN")}
        </div>

      </div>


      <div class="card">

        <div class="label">
          Revenue Recovered
        </div>

        <div class="value">
          ₹${amountRecovered.toLocaleString("en-IN")}
        </div>

      </div>


      <div class="card">

        <div class="label">
          Value Recovery Rate
        </div>

        <div class="value">
          ${recoveryRate.toFixed(2)}%
        </div>

      </div>

    </div>


    <div class="small-metrics">

      <div class="card">

        <div class="label">
          Payments Processed
        </div>

        <div class="value">
          ${totalProcessed}
        </div>

      </div>


      <div class="card">

        <div class="label">
          Recovered
        </div>

        <div class="value">
          ${recovered.length}
        </div>

      </div>


      <div class="card">

        <div class="label">
          Escalated / Blocked
        </div>

        <div class="value">
          ${escalated.length} / ${blocked.length}
        </div>

      </div>

    </div>


    <div class="section">

      <h2>
        Recovery Decisions
      </h2>

      <table>

        <thead>

          <tr>
            <th>Payment</th>
            <th>Amount</th>
            <th>Decision</th>
            <th>Action</th>
            <th>Reason</th>
          </tr>

        </thead>


        <tbody>

          ${results.map((result) => `

            <tr>

              <td>
                ${result.paymentId}
              </td>

              <td>
                ₹${result.amountAtRisk.toLocaleString("en-IN")}
              </td>

              <td class="${result.decision}">
                ${result.decision.toUpperCase()}
              </td>

              <td>
                ${result.action}
              </td>

              <td>
                ${result.reason}
              </td>

            </tr>

          `).join("")}

        </tbody>

      </table>

    </div>

  </div>


  <script>

    const runButton =
      document.getElementById("runButton");

    const status =
      document.getElementById("status");

    const activity =
      document.getElementById("activity");


    function wait(ms) {

      return new Promise(
        resolve => setTimeout(resolve, ms)
      );

    }


    runButton.addEventListener(
      "click",
      async () => {

        runButton.disabled = true;

        status.style.display = "block";

        activity.innerHTML =
          " Loading failed payments...";

        await wait(700);

        activity.innerHTML =
          " RecoverAI is analyzing failure patterns...";

        await wait(900);

        activity.innerHTML =
          " Checking customer payment history...";

        await wait(900);

        activity.innerHTML =
          " Applying recovery policies and stopping rules...";

        await wait(900);

        activity.innerHTML =
          " Executing safe recovery actions...";

        await wait(1000);

        activity.innerHTML =
          " Calculating recovered revenue...";

        await wait(800);

        activity.innerHTML =
          " Recording recovery decisions in the audit trail...";

        await wait(900);

        activity.innerHTML =
          " Recovery batch completed successfully.";

        runButton.disabled = false;

      }
    );

  </script>

</body>

</html>
`;


const server = http.createServer(
  (req, res) => {

    if (req.url === "/") {

      res.writeHead(200, {
        "Content-Type": "text/html",
      });

      res.end(dashboardHtml);

      return;
    }


    if (req.url === "/api/report") {

      res.writeHead(200, {
        "Content-Type": "application/json",
      });

      res.end(
        JSON.stringify(report)
      );

      return;
    }


    res.writeHead(404, {
      "Content-Type": "text/plain",
    });

    res.end("Not found");

  }
);


server.listen(
  PORT,
  () => {

    console.log(
      "\\nRecoverAI dashboard running at:"
    );

    console.log(
      `http://localhost:${PORT}\n`
    );

  }
);