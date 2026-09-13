import { RoomProp } from '../types/index.ts';

export class FurnitureRenderer {
  public static drawProp(ctx: CanvasRenderingContext2D, prop: RoomProp, animTime: number): void {
    ctx.save();
    ctx.translate(prop.x, prop.y);

    switch (prop.type) {
      case 'desk': {
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(-prop.width / 2 + 3, -prop.height / 2 + 5, prop.width, prop.height);

        // Desk top
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-prop.width / 2, -prop.height / 2, prop.width, prop.height, 4);
        ctx.fill();
        ctx.stroke();

        // Keyboard & Mousepad
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-20, -5, 26, 12);
        ctx.fillRect(12, -4, 10, 10);

        // Tech desk LED accent strip
        if (prop.glowColor) {
          ctx.fillStyle = prop.glowColor;
          ctx.shadowColor = prop.glowColor;
          ctx.shadowBlur = 4;
          ctx.fillRect(-prop.width / 2 + 6, prop.height / 2 - 3, prop.width - 12, 2);
          ctx.shadowBlur = 0;
        }

        // Office Chair
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, -prop.height / 2 - 6, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'dual_monitors': {
        // Stand
        ctx.fillStyle = '#475569';
        ctx.fillRect(-15, 6, 30, 4);
        ctx.fillRect(-3, 0, 6, 6);

        // Left Monitor
        ctx.save();
        ctx.translate(-18, 0);
        ctx.rotate(-0.08);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-16, -14, 32, 18);
        // Screen glow
        const glowCol = prop.glowColor || '#10b981';
        ctx.fillStyle = '#022c22';
        ctx.fillRect(-14, -12, 28, 14);
        // Code lines animation
        ctx.fillStyle = glowCol;
        const codeStep = Math.floor(animTime / 300) % 4;
        ctx.fillRect(-12, -10, 12, 1.5);
        ctx.fillRect(-12, -7, 18, 1.5);
        ctx.fillRect(-12, -4, (codeStep + 1) * 4, 1.5);
        ctx.restore();

        // Right Monitor
        ctx.save();
        ctx.translate(18, 0);
        ctx.rotate(0.08);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-16, -14, 32, 18);
        // Screen glow
        ctx.fillStyle = '#082f49';
        ctx.fillRect(-14, -12, 28, 14);
        // Charts/bars animation
        ctx.fillStyle = prop.glowColor || '#38bdf8';
        const barH = Math.sin(animTime / 400) * 3;
        ctx.fillRect(-10, -3 - barH, 4, 5 + barH);
        ctx.fillRect(-4, -6, 4, 8);
        ctx.fillRect(2, -2 + barH, 4, 4 - barH);
        ctx.restore();
        break;
      }

      case 'server_rack': {
        // Chassis
        ctx.fillStyle = '#0b0f19';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-prop.width / 2, -prop.height / 2, prop.width, prop.height, 4);
        ctx.fill();
        ctx.stroke();

        // Units and LED matrix
        const unitHeight = 16;
        const numUnits = Math.floor((prop.height - 10) / unitHeight);
        for (let i = 0; i < numUnits; i++) {
          const uy = -prop.height / 2 + 8 + i * unitHeight;
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(-prop.width / 2 + 4, uy, prop.width - 8, unitHeight - 3);

          // Blinking LEDs
          const ledBlink1 = ((animTime + i * 150) % 600 < 300);
          const ledBlink2 = ((animTime + i * 270) % 800 < 400);

          ctx.fillStyle = ledBlink1 ? (prop.glowColor || '#10b981') : '#064e3b';
          ctx.beginPath();
          ctx.arc(-prop.width / 2 + 10, uy + (unitHeight - 3) / 2, 2, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = ledBlink2 ? '#38bdf8' : '#0c4a6e';
          ctx.beginPath();
          ctx.arc(-prop.width / 2 + 18, uy + (unitHeight - 3) / 2, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'hologram_table': {
        // Circular / pill sci-fi projector table
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, prop.width / 2, prop.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Holographic projector ring
        const holoPulse = Math.sin(animTime / 300) * 4;
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, -6 - holoPulse / 2, prop.width / 3, prop.height / 3 + holoPulse, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Projector beam upward
        const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, prop.width / 2);
        grad.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
        grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(0, 0, prop.width / 2.5, prop.height / 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      }

      case 'couch': {
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-prop.width / 2, -prop.height / 2, prop.width, prop.height, 6);
        ctx.fill();
        ctx.stroke();

        // Cushions
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-prop.width / 2 + 4, -prop.height / 2 + 4, prop.width - 8, prop.height - 12);
        break;
      }

      case 'coffee_table': {
        ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(-prop.width / 2, -prop.height / 2, prop.width, prop.height, 4);
        ctx.fill();
        ctx.stroke();

        // Coffee mug
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(-8, -4, 4, 0, Math.PI * 2);
        ctx.fill();
        // Tablet device
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(4, -8, 16, 12);
        break;
      }

      case 'water_cooler': {
        // Dispenser body
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(-prop.width / 2, -prop.height / 4, prop.width, prop.height * 0.75);
        // Water bottle (blue translucent)
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(0, -prop.height / 3, prop.width / 2 - 1, 0, Math.PI * 2);
        ctx.fill();
        // Bubble inside
        const bubbleY = (animTime / 100) % 12;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(2, -prop.height / 3 + 4 - bubbleY, 1.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'vending_machine': {
        ctx.fillStyle = '#3b0764';
        ctx.strokeStyle = '#7c3aed';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-prop.width / 2, -prop.height / 2, prop.width, prop.height, 4);
        ctx.fill();
        ctx.stroke();

        // Glass window with snacks
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-prop.width / 2 + 5, -prop.height / 2 + 6, prop.width - 10, prop.height / 2);
        // Drinks row
        const colors = ['#ef4444', '#10b981', '#38bdf8', '#f59e0b'];
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = colors[i];
          ctx.fillRect(-prop.width / 2 + 8 + i * 8, -prop.height / 2 + 10, 5, 8);
        }
        break;
      }

      case 'bookshelf': {
        ctx.fillStyle = '#451a03';
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 2;
        ctx.fillRect(-prop.width / 2, -prop.height / 2, prop.width, prop.height);
        ctx.strokeRect(-prop.width / 2, -prop.height / 2, prop.width, prop.height);

        // Books in shelf
        const bookColors = ['#dc2626', '#2563eb', '#16a34a', '#d97706', '#9333ea'];
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = bookColors[i % bookColors.length];
          ctx.fillRect(-prop.width / 2 + 5 + i * 10, -prop.height / 2 + 4, 8, prop.height - 8);
        }
        break;
      }

      case 'whiteboard': {
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 2;
        ctx.fillRect(-prop.width / 2, -prop.height / 2, prop.width, prop.height);
        ctx.strokeRect(-prop.width / 2, -prop.height / 2, prop.width, prop.height);

        // Flowchart scribbles
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(-prop.width / 2 + 10, -4, 14, 8);
        ctx.fillStyle = '#10b981';
        ctx.fillRect(-prop.width / 2 + 35, -4, 14, 8);
        ctx.strokeStyle = '#64748b';
        ctx.beginPath();
        ctx.moveTo(-prop.width / 2 + 24, 0);
        ctx.lineTo(-prop.width / 2 + 35, 0);
        ctx.stroke();
        break;
      }

      case 'plant': {
        // Pot
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.arc(0, 4, 8, 0, Math.PI * 2);
        ctx.fill();

        // Lush green leaves with subtle sway
        const sway = Math.sin(animTime / 800) * 0.08;
        ctx.save();
        ctx.rotate(sway);
        ctx.fillStyle = '#22c55e';
        for (let i = 0; i < 5; i++) {
          const angle = (i * Math.PI * 2) / 5;
          ctx.beginPath();
          ctx.ellipse(Math.cos(angle) * 7, Math.sin(angle) * 7 - 4, 6, 4, angle, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        break;
      }
    }

    ctx.restore();
  }
}
