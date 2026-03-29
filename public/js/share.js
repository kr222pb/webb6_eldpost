import { Tent } from './tent.js';
const BASE = window.APP_BASE || "";
// Hanterar delning av eldpost
async function loadSharedSchedule() {
  try {
    const token = window.shareToken;
    const res = await fetch(`${BASE}/share-data/${token}`);
    const data = await res.json();

    if (!data.success) {
      document.getElementById("schemaTables").innerHTML = `<p>${data.message || "Kunde inte ladda schema"}</p>`;
      return;
    }

    const rowHTML = (type) =>
      data.entries
        .filter(r => r.type === type)
        .map(r => {
          const time = `${r.time_start} - ${r.time_end}`;
          const names = r.soldier_names || "Okänd";
          return `<tr><td>${time}</td><td>${names}</td></tr>`;
        })
        .join("");
    document.getElementById("schemaTables").innerHTML = `
      <div class="eldpost-summary">
        <h3>Vaktpost-schema</h3>
        <table id="vaktpostTable" class="styled-schedule-table">
          <thead><tr><th>Tid</th><th>Soldat</th></tr></thead>
          <tbody>${rowHTML("Vaktpost")}</tbody>
        </table>

        <h3>Patrull-schema</h3>
        <table id="patrullTable" class="styled-schedule-table">
          <thead><tr><th>Tid</th><th>Soldater</th></tr></thead>
          <tbody>${rowHTML("Patrull")}</tbody>
        </table>

        <canvas id="tentCanvas" width="400" height="400"></canvas>
      </div>
    `;

    if (data.soldiers && data.soldiers.length > 0) {
        console.log("soldiers for tent:", data.soldiers);
      const canvas = document.getElementById("tentCanvas");
      const tent = new Tent(canvas);

      const maxSeats = Math.max(...data.soldiers.map(s => Number(s.sovplats) || 0));
      tent.drawTent(data.soldiers, maxSeats);
    }
  } catch (err) {
    console.error("Fel vid laddning av delat schema:", err);
    document.getElementById("schemaTables").innerHTML = `<p>Fel vid laddning av schema.</p>`;
  }
}

if (window.shareToken) {
  loadSharedSchedule();
}