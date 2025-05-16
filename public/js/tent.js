export class Tent {
    constructor(canvasElement) {
      this.canvas = canvasElement;
      this.ctx = this.canvas?.getContext("2d");
      this.selectedSeat = null;
      this.soldiers = [];
      this.maxSeats = 0;
    }
  
    drawTent(soldiers, maxSeats) {
      if (!this.canvas || !this.ctx) return;
  
      this.soldiers = soldiers;
      this.maxSeats = maxSeats;
  
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  
      const centerX = this.canvas.width / 2;
      const centerY = this.canvas.height / 2;
      const radius = 140;
      const angleStep = (2 * Math.PI) / maxSeats;
  
      for (let i = 0; i < maxSeats; i++) {
        const startAngle = i * angleStep;
        const endAngle = startAngle + angleStep;
  
        const seatNumber = i + 1;
        const occupied = soldiers.find(s => s.sovplats === seatNumber);
        const isSelected = seatNumber === this.selectedSeat;
  
        this.ctx.fillStyle = isSelected ? "#ff4d4d" : occupied ? "#A79C60" : "#8E7B50";
  
        this.ctx.beginPath();
        this.ctx.moveTo(centerX, centerY);
        this.ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.strokeStyle = "black";
        this.ctx.stroke();
  
        const textX = centerX + Math.cos(startAngle + angleStep / 2) * (radius * 0.65);
        const textY = centerY + Math.sin(startAngle + angleStep / 2) * (radius * 0.65);
        this.ctx.fillStyle = "black";
        this.ctx.font = "16px Arial";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(seatNumber, textX, textY);
      }
    }
  
    highlightSeat(seatNumber) {
      this.selectedSeat = seatNumber;
      this.drawTent(this.soldiers, this.maxSeats); 
    }
  }
  