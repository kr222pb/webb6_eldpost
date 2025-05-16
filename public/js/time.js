class TimeSettings extends HTMLElement {
    connectedCallback() {
      this.innerHTML = `
        <div class="step hidden" id="time-settings"> 
          <h2>Tidsinställningar</h2>
          <form class="time-settings">
            <div class="time-row">
              <div class="time-group">
                <label for="eldpost_start">Eldpost Start:</label>
                <input type="time" id="eldpost_start" required>
              </div>
              <div class="time-group">
                <label for="eldpost_end">Eldpost Slut:</label>
                <input type="time" id="eldpost_end" required>
              </div>
            </div>
  
            <div class="time-row">
              <div class="time-group">
                <label for="vaktpost_duration">Vaktpostens varaktighet:</label>
                <select id="vaktpost_duration">
                  <option value="1">1 timme</option>
                </select>
              </div>
  
              <div class="time-group">
                <label for="patrull_duration">Patrullens varaktighet:</label>
                <select id="patrull_duration">
                  <option value="1">1 timme</option>
                </select>
              </div>
            </div>
          </form>
  
          <div class="button-container">
            <button class="prev-btn" data-prev="dashboard">Tillbaka</button>
            <button class="next-btn" data-next="soldiers">Nästa</button>
          </div>
        </div>
      `;
  
      this.querySelector(".next-btn")?.addEventListener("click", async (e) => {
        e.preventDefault();
  
        const eldpost_id = document.querySelector("#eldpostIdDisplay")?.dataset.eldpostId;
        const start = this.querySelector("#eldpost_start")?.value;
        const end = this.querySelector("#eldpost_end")?.value;
        const vakt = this.querySelector("#vaktpost_duration")?.value;
        const patrull = this.querySelector("#patrull_duration")?.value;
  
        if (!eldpost_id || !start || !end || !vakt || !patrull) {
          alert("Fyll i alla fält!");
          return;
        }
  
        try {
          const res = await fetch("/save-schedule", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eldpost_id,
              eldpost_start: start,
              eldpost_end: end,
              vaktpost_duration: vakt,
              patrull_duration: patrull
            })
          });
  
          const data = await res.json();
          if (data.success) {
            console.log(" Tidsinställningar sparade för eldpost:", eldpost_id);
  
            // Navigera till nästa steg
            document.querySelectorAll(".step").forEach(step =>
              step.classList.remove("active", "hidden")
            );
            document.getElementById("soldiers")?.classList.add("active");
          } else {
            alert(" Kunde inte spara: " + data.message);
          }
        } catch (err) {
          console.error("Fel vid nätverksanrop:", err);
          alert("Något gick fel när tidsinställningarna skulle sparas.");
        }
      });
  
      this.querySelector(".prev-btn").addEventListener("click", () => {
        document.querySelectorAll(".step").forEach(s =>
          s.classList.remove("active", "hidden")
        );
        document.getElementById("dashboard")?.classList.add("active");
      });
    }
  }
  
  customElements.define("time-settings", TimeSettings);
  