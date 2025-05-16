import { Tent } from './tent.js';
export class EldpostDashboard extends HTMLElement {
  async connectedCallback() {
    this.innerHTML = `
      <div class="step active" id="dashboard">
        <h2>Välkommen till Eldpost</h2>
        <p>Här kan du skapa och hantera dina eldpostlistor.</p>

        <a href="/login" class="login-btn" id="loginBtn">Logga in med Google</a>
        <a href="/logout" class="logout-btn hidden" id="logoutBtn">Logga ut</a>

        <div id="actionSection" class="hidden">
          <button id="newEldpostBtn">Skapa Ny Eldpostlista</button>
          <button id="viewListsBtn">Se Tidigare Listor</button>
        </div>

        <div id="eldpostResult" class="hidden">
          <p><span id="eldpostIdDisplay" data-eldpost-id=""></span></p>
        </div>

        <div id="userInfo"></div>
        <div id="schemaTables"></div>
      </div>
    `;

    this.schemaTables = this.querySelector("#schemaTables");
    this.eldpostIdDisplay = this.querySelector("#eldpostIdDisplay");

    await this.checkLoginStatus();
    this.setupEventHandlers();
  }

  async checkLoginStatus() {
    try {
      const res = await fetch("/user");
      const data = await res.json();

      if (data.logged_in) {
        this.querySelector("#userInfo").innerHTML = `<p>Välkommen, <strong>${data.user.display_name}</strong></p>`;
        this.querySelector("#loginBtn").classList.add("hidden");
        this.querySelector("#logoutBtn").classList.remove("hidden");
        this.querySelector("#actionSection").classList.remove("hidden");
      }
    } catch (e) {
      console.error("Login-kontroll misslyckades", e);
    }
  }

  setupEventHandlers() {
    
    this.querySelector("#logoutBtn").addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = "/logout";
    });

    this.querySelector("#newEldpostBtn").addEventListener("click", async () => {
      try {
        const res = await fetch("/eldpostlists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({})
        });

        const data = await res.json();
        if (data.success && data.eldpost_id) {
          this.eldpostIdDisplay.textContent = `Eldpost ID: ${data.eldpost_id}`;
          this.eldpostIdDisplay.dataset.eldpostId = data.eldpost_id;
          this.querySelector("#eldpostResult").classList.remove("hidden");

          const soldierForm = document.querySelector("soldier-form");
          if (soldierForm) soldierForm.eldpost_id = data.eldpost_id;

          document.querySelectorAll(".step").forEach(s => s.classList.remove("active", "hidden"));
          document.getElementById("time-settings")?.classList.add("active");
        } else {
          alert("Kunde inte skapa eldpostlista.");
        }
      } catch (err) {
        console.error("Nätverksfel:", err);
        alert("Fel vid skapande av lista.");
      }
    });

    this.querySelector("#viewListsBtn").addEventListener("click", () => this.loadPreviousSchedules());
  }

  async loadPreviousSchedules() {
    try {
      const res = await fetch("/my-schedules");
      const data = await res.json();

      if (!data.success) {
        this.schemaTables.innerHTML = `<p>Inga sparade scheman hittades.</p>`;
        return;
      }

      const grouped = {};
      for (const row of data.entries) {
        (grouped[row.eldpost_id] = grouped[row.eldpost_id] || []).push(row);
      }

      this.schemaTables.innerHTML = Object.entries(grouped).map(([id, rows]) => {
        const dateStr = rows[0].created_at
          ? new Date(rows[0].created_at).toLocaleString("sv-SE")
          : "Okänd tid";

        const vaktRows = rows.filter(r => r.type === "Vaktpost")
          .map(r => `<tr><td>${r.time_start} - ${r.time_end}</td><td>${r.soldier_names}</td></tr>`).join("");
        const patrullRows = rows.filter(r => r.type === "Patrull")
          .map(r => `<tr><td>${r.time_start} - ${r.time_end}</td><td>${r.soldier_names}</td></tr>`).join("");

        return `
          <div class="eldpost-summary">
            <p><strong>Eldpost ID ${id}</strong> – ${dateStr}</p>
            <button class="toggle-schema" data-id="${id}"> Visa schema</button>
            <div id="schema-${id}" class="schema-details hidden">
              <h3>Vaktpost-schema</h3>
              <table id="vaktpostTable">
                <thead><tr><th>Tid</th><th>Soldat</th></tr></thead>
                <tbody>${vaktRows}</tbody>
              </table>
              <h3>Patrull-schema</h3>
              <table id="patrullTable">
                <thead><tr><th>Tid</th><th>Soldater</th></tr></thead>
                <tbody>${patrullRows}</tbody>
              </table>
              <canvas id="tentCanvas-${id}" width="400" height="400"></canvas>
            </div>
          </div>
        `;
      }).join("");

      this.schemaTables.querySelectorAll(".toggle-schema").forEach(btn => {
        btn.addEventListener("click", async () => {
          const id = btn.dataset.id;
          const target = document.getElementById(`schema-${id}`);
          target.classList.toggle("hidden");
          btn.textContent = target.classList.contains("hidden") ? " Visa schema" : " Dölj schema";

          if (!target.classList.contains("hidden")) {
            try {
              const canvas = document.getElementById(`tentCanvas-${id}`);
              const tent = new Tent(canvas);
              const res = await fetch(`/soldiers/${id}`);
              const soldiers = await res.json();
              const maxSeats = Math.max(...soldiers.map(s => s.sovplats));
              tent.drawTent(soldiers, maxSeats);
            } catch (e) {
              console.warn("Kunde inte rita tält", e);
            }
          }
        });
      });
    } catch (err) {
      console.error("Fel vid hämtning:", err);
      this.schemaTables.innerHTML = `<p>Fel vid hämtning av schema.</p>`;
    }
  }
  renderSingleSchedule(entries, eldpostId) {
    const rowHTML = (type) =>
      entries
        .filter(r => r.type === type)
        .map(r => {
          const name = r.soldier || r.soldier_names || "Okänd";
          const time = r.time || `${r.time_start} - ${r.time_end}`;
          return `<tr><td>${time}</td><td>${name}</td></tr>`;
        })
        .join("");
  
    this.schemaTables.innerHTML = `
      <div class="eldpost-summary">
        <h3>Vaktpost-schema (senast skapad)</h3>
        <table id="vaktpostTable" class="styled-schedule-table">
          <thead><tr><th>Tid</th><th>Soldat</th></tr></thead>
          <tbody>${rowHTML("Vaktpost")}</tbody>
        </table>
  
        <h3>Patrull-schema (senast skapad)</h3>
        <table id="patrullTable" class="styled-schedule-table">
          <thead><tr><th>Tid</th><th>Soldater</th></tr></thead>
          <tbody>${rowHTML("Patrull")}</tbody>
        </table>
  
        <canvas id="tentCanvas" width="400" height="400""></canvas>
      </div>
    `;
  
    setTimeout(async () => {
      try {
        const canvas = document.getElementById("tentCanvas");
        const tent = new Tent(canvas);
        const res = await fetch(`/soldiers/${eldpostId}`);
        const soldiers = await res.json();
        const maxSeats = Math.max(...soldiers.map(s => s.sovplats));
        tent.drawTent(soldiers, maxSeats);
      } catch (e) {
        console.warn("Kunde inte rita tält (senaste schema)", e);
      }
    }, 0);
  }
  
  
}


customElements.define("eldpost-dashboard", EldpostDashboard);