import { Tent } from './tent.js';
const BASE = window.APP_BASE || "";
export class EldpostDashboard extends HTMLElement {
  async connectedCallback() {
    this.innerHTML = `
      <div class="step active" id="dashboard">
        <h2>Välkommen till Eldpost</h2>
        <p>Här kan du skapa och hantera dina eldpostlistor.</p>

        <a href="${BASE}/login" class="login-btn" id="loginBtn">Logga in med Google</a>
        <a href="${BASE}/logout" class="logout-btn hidden" id="logoutBtn">Logga ut</a>  

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
  // Kollar om användaren är inloggad och visar rätt knappar
  async checkLoginStatus() {
    try {
      const res = await fetch(`${BASE}/user`);
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
      window.location.href = `${BASE}/logout`;
    });

    this.querySelector("#newEldpostBtn").addEventListener("click", async () => {
      try {
        const res = await fetch(`${BASE}/eldpostlists`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({})
        });

        const data = await res.json();
        if (data.success && data.eldpost_id) {
          this.eldpostIdDisplay.textContent = `Eldpost ID: ${data.eldpost_id}`;
          this.eldpostIdDisplay.dataset.eldpostId = data.eldpost_id;
          this.querySelector("#eldpostResult").classList.remove("hidden");

          const timeSettings = document.querySelector("time-settings");
          const soldierForm = document.querySelector("soldier-form");

          timeSettings?.resetForm?.();
          soldierForm?.resetForm?.();

          if (soldierForm) soldierForm.eldpost_id = data.eldpost_id;

          this.schemaTables.innerHTML = "";

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
// Hämtar och visar alla tidigare scheman
  async loadPreviousSchedules() {
    try {
      const res = await fetch(`${BASE}/my-schedules`);
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
            <button class="share-btn" data-id="${id}">Skapa delningslänk</button>
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
      this.schemaTables.querySelectorAll(".share-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const eldpostId = btn.dataset.id;

        try {
         const res = await fetch(`${BASE}/share/create`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ eldpost_id: eldpostId })
          });

          const text = await res.text();
          console.log("Server response:", text);

          const data = JSON.parse(text);

          if (data.success && data.link) {
            await navigator.clipboard.writeText(data.link);
            alert("Delningslänk kopierad:\n" + data.link);
          } else {
            alert("Fel från servern:\n" + data.error);
          }
        } catch (err) {
          console.error("Fel vid skapande av delningslänk:", err);
          alert("Något gick fel");
        }
      });
    });
      this.schemaTables.querySelectorAll(".toggle-schema").forEach(btn => {
        btn.addEventListener("click", async () => {
          const id = btn.dataset.id;
          const target = document.getElementById(`schema-${id}`);
          target.classList.toggle("hidden");
          btn.textContent = target.classList.contains("hidden") ? " Visa schema" : " Dölj schema";

            if (!target.classList.contains("hidden")) {
              try {
                const res = await fetch(`${BASE}/soldiers/${id}`);
                const soldiersRaw = await res.json();

                const soldiers = soldiersRaw.map(s => ({
                  ...s,
                  name: s.name,
                  sovplats: Number(s.sovplats ?? s.sovplatss) || 0
                }));

                const maxSeats = Math.max(...soldiers.map(s => s.sovplats || 0));

                requestAnimationFrame(() => {
                  const canvas = document.getElementById(`tentCanvas-${id}`);
                  const tent = new Tent(canvas);
                  tent.drawTent(soldiers, maxSeats);
                });
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
  // Visar ett enskilt schema
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
  
        <canvas id="tentCanvas" width="400" height="400"></canvas>
        
      </div>
    `;
  
    setTimeout(async () => {
      try {
        const canvas = document.getElementById("tentCanvas");
        const tent = new Tent(canvas);

        const res = await fetch(`${BASE}/soldiers/${eldpostId}`);
        const soldiersRaw = await res.json();

        const soldiers = soldiersRaw.map(s => ({
          ...s,
          name: s.name,
          sovplats: Number(s.sovplats ?? s.sovplatss) || 0
        }));

        const maxSeats = Math.max(...soldiers.map(s => s.sovplats || 0));
        tent.drawTent(soldiers, maxSeats);
      } catch (e) {
        console.warn("Kunde inte rita tält (senaste schema)", e);
      }
    }, 0);
  }
  
  
}


customElements.define("eldpost-dashboard", EldpostDashboard);