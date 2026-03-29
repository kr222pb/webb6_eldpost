import { Tent } from './tent.js';
const BASE = window.APP_BASE || "";
class SoldierForm extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <div class="step hidden" id="soldiers">
        <h2>Lägg till Soldater</h2>

        <div class="form-section">
          <label for="numSeats">Antal sovplatser:</label>
          <select id="numSeats">
            ${Array.from({ length: 17 }, (_, i) => i + 4)
              .map(n => `<option value="${n}">${n}</option>`)
              .join("")}
          </select>
        </div>

        <div class="form-section">
          <label for="soldierName">Namn:</label>
          <input type="text" id="soldierName" placeholder="Ange namn" />
        </div>

        <div class="form-section">
          <label for="roleSelect">Roll:</label>
          <select id="roleSelect"></select>
        </div>

        <button id="addSoldierBtn">Lägg till soldat</button>

        <h3>Lista över soldater:</h3>
        <canvas id="tentCanvas" width="400" height="400"></canvas>
        <div id="soldierList"></div>

        <div class="button-container">
          <button class="prev-btn" data-prev="time-settings">Tillbaka</button>
          <button id="saveSoldiersBtn">Generera</button>
        </div>
      </div>
    `;

    this.roles = [];
    this.soldiers = [];
    this.maxSeats = 4;
    this.tent = new Tent(this.querySelector("#tentCanvas"));

    this.loadRoles();
    this.setupEvents();
  }
// Hämtar roller från backend 
  async loadRoles() {
    try {
      const res = await fetch(`${BASE}/roles`);
      const roles = await res.json();
      this.roles = roles;

      const select = this.querySelector("#roleSelect");
      roles.forEach(role => {
        const option = document.createElement("option");
        option.value = role.id;
        option.textContent = role.role_name;
        select.appendChild(option);
      });
    } catch (err) {
      console.error("Kunde inte ladda roller:", err);
    }
  }
// Uppdaterar tältet när antal sovplatser ändras
  setupEvents() {
    this.querySelector("#numSeats").addEventListener("change", (e) => {
      this.maxSeats = parseInt(e.target.value);
      this.tent.drawTent(this.soldiers, this.maxSeats);
    });

    this.querySelector("#addSoldierBtn").addEventListener("click", () => this.addSoldier());
    this.querySelector("#saveSoldiersBtn").addEventListener("click", () => this.submitSoldiers());

    this.querySelector(".prev-btn").addEventListener("click", () => {
      document.querySelectorAll(".step").forEach(s => s.classList.remove("active", "hidden"));
      document.getElementById("time-settings")?.classList.add("active");
    });
  }
// Stoppar om alla sovplatser redan är fyllda
  addSoldier() {
    if (this.soldiers.length >= this.maxSeats) {
      alert("Max antal sovplatser uppnått.");
      return;
    }

    const nameInput = this.querySelector("#soldierName");
    const roleSelect = this.querySelector("#roleSelect");
    const name = nameInput.value.trim();
    const roleId = parseInt(roleSelect.value);

    if (!name) {
      alert("Ange ett namn.");
      return;
    }

    const used = this.soldiers.map(s => s.sovplats);
    let sovplats = 1;
    while (used.includes(sovplats)) sovplats++;

    const soldier = { name, role_id: roleId, sovplats };
    this.soldiers.push(soldier);
    nameInput.value = "";
    this.updateSoldierList();
  }
  // Nollställer formuläret när en ny eldpost skapas
  resetForm() {
    this.soldiers = [];
    this.maxSeats = 4;

    const numSeats = this.querySelector("#numSeats");
    const soldierName = this.querySelector("#soldierName");
    const roleSelect = this.querySelector("#roleSelect");
    const soldierList = this.querySelector("#soldierList");

    if (numSeats) numSeats.value = "4";
    if (soldierName) soldierName.value = "";
    if (roleSelect) roleSelect.selectedIndex = 0;
    if (soldierList) soldierList.innerHTML = "";

    this.tent.selectedSeat = null;
    this.tent.drawTent([], this.maxSeats);
  }
  updateSoldierList() {
    const container = this.querySelector("#soldierList");
    container.innerHTML = "";

    const table = document.createElement("table");
    table.id = "soldierTable";
    table.innerHTML = `
      <thead>
        <tr><th>Namn</th><th>Roll</th><th>Sovplats</th></tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector("tbody");

    this.soldiers.forEach((s, i) => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td><input type="text" value="${s.name}"></td>
        <td>
          <select>${this.roles.map(r =>
            `<option value="${r.id}" ${r.id === s.role_id ? "selected" : ""}>${r.role_name}</option>`
          ).join("")}</select>
        </td>
        <td><input type="number" min="1" max="${this.maxSeats}" value="${s.sovplats}"></td>
      `;

      const [nameInput, roleSelect, sovInput] = row.querySelectorAll("input, select");
      nameInput.addEventListener("input", e => this.soldiers[i].name = e.target.value);
      roleSelect.addEventListener("change", e => this.soldiers[i].role_id = parseInt(e.target.value));
      sovInput.addEventListener("input", e => {
        const val = parseInt(e.target.value);
        if (val >= 1 && val <= this.maxSeats) {
          this.soldiers[i].sovplats = val;
          this.tent.drawTent(this.soldiers, this.maxSeats);
        }
      });

      row.addEventListener("click", () => this.tent.highlightSeat(s.sovplats));
      tbody.appendChild(row);
    });

    container.appendChild(table);
    this.tent.drawTent(this.soldiers, this.maxSeats);
  }

  async submitSoldiers() {
    const eldpost_id = document.querySelector("#eldpostIdDisplay")?.dataset.eldpostId;
    if (!eldpost_id) return console.warn(" Eldpost ID saknas");

    if (this.soldiers.length !== this.maxSeats) {
      alert(`Du har ${this.soldiers.length} soldater men ${this.maxSeats} sovplatser.`);
      return;
    }

    const used = new Set();
    for (let s of this.soldiers) {
      if (!s.name || !s.role_id || !s.sovplats) {
        alert("Alla soldater måste ha namn, roll och sovplats.");
        return;
      }
      if (used.has(s.sovplats)) {
        alert(`Sovplats ${s.sovplats} är dubbelbokad.`);
        return;
      }
      used.add(s.sovplats);
    }

    try {
      for (const s of this.soldiers) {
        await fetch(`${BASE}/soldiers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...s, eldpost_id })
        });
      }

      const schemaRes = await fetch(`${BASE}/generate-schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eldpost_id })
      });
      const schemaData = await schemaRes.json();

      if (schemaData.success) {
        await fetch(`${BASE}/save-generated-schedule`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eldpost_id,
            entries: schemaData.schema.schema
          })
          
        });
        

        document.querySelectorAll(".step").forEach(s => s.classList.remove("active", "hidden"));
        document.getElementById("dashboard")?.classList.add("active");

        const dashboard = document.querySelector("eldpost-dashboard");
        if (dashboard?.renderSingleSchedule) {
          dashboard.renderSingleSchedule(schemaData.schema.schema, eldpost_id);
        }
      } else {
        alert("Kunde inte generera schema.");
      }
    } catch (err) {
      console.error("Fel vid sparande/generering:", err);
    }
  }
}

customElements.define("soldier-form", SoldierForm);
