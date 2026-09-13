import { AgentModel, Position } from '../types/index.ts';

export class AgentSpriteRenderer {
  /**
   * Draw an agent character on canvas context.
   * @param ctx Canvas 2D rendering context
   * @param agent Agent data model
   * @param animTime Global animation time in ms
   * @param isSelected Whether agent is currently selected
   * @param isHovered Whether cursor is hovering over agent
   */
  public static draw(
    ctx: Canvas2DContext,
    agent: AgentModel,
    animTime: number,
    isSelected: boolean = false,
    isHovered: boolean = false
  ): void {
    const x = agent.currentPosition.x;
    const y = agent.currentPosition.y;
    const status = agent.status;
    const facing = agent.facing;

    // Animation cycle
    const walkCycle = (animTime / 180) % (Math.PI * 2);
    const idleCycle = (animTime / 1000) % (Math.PI * 2);
    const typingCycle = (animTime / 100) % (Math.PI * 2);

    ctx.save();
    ctx.translate(x, y);

    // 1. Selection reticle / ring
    if (isSelected) {
      const pulse = Math.sin(animTime / 200) * 3;
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 24 + pulse, 0, Math.PI * 2);
      ctx.stroke();

      // Cyber crosshairs
      const crossSize = 28 + pulse;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-crossSize, 0); ctx.lineTo(-crossSize + 6, 0);
      ctx.moveTo(crossSize, 0); ctx.lineTo(crossSize - 6, 0);
      ctx.moveTo(0, -crossSize); ctx.lineTo(0, -crossSize + 6);
      ctx.moveTo(0, crossSize); ctx.lineTo(0, crossSize - 6);
      ctx.stroke();
      ctx.restore();
    } else if (isHovered) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 2. Drop Shadow under feet
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 6, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Subtle bobbing offset based on state
    let bobY = 0;
    if (status === 'WALKING') {
      bobY = Math.abs(Math.sin(walkCycle)) * -4;
    } else if (status === 'IDLE' || status === 'THINKING') {
      bobY = Math.sin(idleCycle) * 1.5;
    }

    // 3. Legs / Feet
    ctx.save();
    ctx.translate(0, bobY);

    if (status === 'WALKING') {
      const legSwing = Math.sin(walkCycle) * 6;
      // Left leg
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-6, 2 - legSwing, 4, 7 + legSwing);
      // Right leg
      ctx.fillRect(2, 2 + legSwing, 4, 7 - legSwing);
      // Shoes
      ctx.fillStyle = agent.avatar.accentColor;
      ctx.fillRect(-7, 7, 5, 3);
      ctx.fillRect(1, 7, 5, 3);
    } else if (status === 'WORKING') {
      // Sitting at desk - legs tucked
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-5, 3, 4, 4);
      ctx.fillRect(1, 3, 4, 4);
    } else {
      // Standing
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-6, 2, 4, 6);
      ctx.fillRect(2, 2, 4, 6);
      // Shoes
      ctx.fillStyle = agent.avatar.accentColor;
      ctx.fillRect(-7, 6, 5, 3);
      ctx.fillRect(1, 6, 5, 3);
    }

    // 4. Torso / Clothes
    ctx.fillStyle = agent.avatar.suitColor;
    ctx.beginPath();
    ctx.roundRect(-8, -12, 16, 15, 3);
    ctx.fill();

    // Collar / Accent tie or stripe
    ctx.fillStyle = agent.avatar.accentColor;
    ctx.fillRect(-2, -12, 4, 8);
    // Role badge dot on chest
    ctx.beginPath();
    ctx.arc(3, -7, 2, 0, Math.PI * 2);
    ctx.fill();

    // 5. Arms & Hands
    if (status === 'WORKING') {
      // Typing hands alternating rapidly
      const handOffset1 = Math.sin(typingCycle) * 2;
      const handOffset2 = Math.cos(typingCycle) * 2;
      ctx.fillStyle = agent.avatar.skinColor;
      ctx.fillRect(-9, -7 + handOffset1, 4, 4);
      ctx.fillRect(5, -7 + handOffset2, 4, 4);
    } else if (status === 'THINKING') {
      // One hand on chin
      ctx.fillStyle = agent.avatar.skinColor;
      ctx.fillRect(2, -17, 4, 4);
      ctx.fillRect(-9, -8, 3, 6);
    } else if (status === 'WALKING') {
      const armSwing = Math.sin(walkCycle) * 4;
      ctx.fillStyle = agent.avatar.suitColor;
      ctx.fillRect(-10, -11 + armSwing, 3, 8);
      ctx.fillRect(7, -11 - armSwing, 3, 8);
    } else {
      ctx.fillStyle = agent.avatar.suitColor;
      ctx.fillRect(-10, -11, 3, 8);
      ctx.fillRect(7, -11, 3, 8);
    }

    // 6. Head
    ctx.fillStyle = agent.avatar.skinColor;
    ctx.beginPath();
    ctx.arc(0, -18, 9, 0, Math.PI * 2);
    ctx.fill();

    // Eyes & Blinking (blink every 4 seconds)
    const isBlinking = animTime % 3600 < 140;
    if (agent.avatar.accessory === 'glasses') {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-6, -20, 5, 4);
      ctx.strokeRect(1, -20, 5, 4);
      ctx.beginPath();
      ctx.moveTo(-1, -18); ctx.lineTo(1, -18);
      ctx.stroke();
    } else if (agent.avatar.accessory === 'visor') {
      // Cyber visor glowing
      ctx.fillStyle = agent.avatar.accentColor;
      ctx.shadowColor = agent.avatar.accentColor;
      ctx.shadowBlur = 4;
      ctx.fillRect(-7, -21, 14, 5);
      ctx.shadowBlur = 0;
    } else {
      // Normal eyes
      if (!isBlinking) {
        ctx.fillStyle = '#0f172a';
        if (facing === 'left') {
          ctx.fillRect(-6, -19, 2, 3);
          ctx.fillRect(-2, -19, 2, 3);
        } else if (facing === 'right') {
          ctx.fillRect(0, -19, 2, 3);
          ctx.fillRect(4, -19, 2, 3);
        } else {
          ctx.fillRect(-4, -19, 2, 3);
          ctx.fillRect(2, -19, 2, 3);
        }
      } else {
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-5, -18); ctx.lineTo(-2, -18);
        ctx.moveTo(1, -18); ctx.lineTo(4, -18);
        ctx.stroke();
      }
    }

    // 7. Hair
    ctx.fillStyle = agent.avatar.hairColor;
    if (agent.avatar.hairStyle === 'spiky') {
      ctx.beginPath();
      ctx.moveTo(-9, -22);
      ctx.lineTo(-6, -29);
      ctx.lineTo(-2, -24);
      ctx.lineTo(1, -30);
      ctx.lineTo(5, -24);
      ctx.lineTo(8, -28);
      ctx.lineTo(9, -21);
      ctx.closePath();
      ctx.fill();
    } else if (agent.avatar.hairStyle === 'bob') {
      ctx.beginPath();
      ctx.arc(0, -22, 9.5, Math.PI, 0);
      ctx.fillRect(-9.5, -22, 19, 7);
      ctx.fill();
    } else if (agent.avatar.hairStyle === 'curly') {
      ctx.beginPath();
      ctx.arc(-5, -25, 4.5, 0, Math.PI * 2);
      ctx.arc(0, -27, 5, 0, Math.PI * 2);
      ctx.arc(5, -25, 4.5, 0, Math.PI * 2);
      ctx.arc(-8, -21, 3.5, 0, Math.PI * 2);
      ctx.arc(8, -21, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (agent.avatar.hairStyle === 'visor') {
      // Slick tech helmet/hair
      ctx.beginPath();
      ctx.arc(0, -21, 9, Math.PI * 0.9, Math.PI * 0.1);
      ctx.fill();
    } else {
      // Short hair default
      ctx.beginPath();
      ctx.arc(0, -22, 9, Math.PI * 0.9, Math.PI * 0.1);
      ctx.fillRect(-8.5, -24, 17, 5);
      ctx.fill();
    }

    // Accessories
    if (agent.avatar.accessory === 'headset') {
      // Headset band and mic
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -21, 10.5, Math.PI * 0.8, Math.PI * 0.2);
      ctx.stroke();
      // Ear piece
      ctx.fillStyle = agent.avatar.accentColor;
      ctx.fillRect(8, -22, 3, 5);
      // Mic tip
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(4, -14, 2, 2);
    } else if (agent.avatar.accessory === 'antenna') {
      // Cute robot antenna
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -26); ctx.lineTo(0, -32);
      ctx.stroke();
      ctx.fillStyle = agent.avatar.accentColor;
      ctx.beginPath();
      ctx.arc(0, -33, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore(); // Restore leg/torso translate

    // 8. Status icon badge over head
    const badgeY = -34 + bobY;
    if (status === 'THINKING') {
      // Thought bubble with animated bouncing dots
      ctx.save();
      ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-16, badgeY - 14, 32, 16, 8);
      ctx.fill();
      ctx.stroke();

      // 3 dots
      for (let i = 0; i < 3; i++) {
        const dotOffset = Math.sin((animTime / 150) + i * 1.2) * 2;
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(-8 + i * 8, badgeY - 6 + dotOffset, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (status === 'WORKING') {
      // Mini gear or code terminal badge
      ctx.save();
      ctx.fillStyle = 'rgba(16, 185, 129, 0.95)';
      ctx.beginPath();
      ctx.arc(10, badgeY + 6, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚡', 10, badgeY + 6);
      ctx.restore();
    } else if (status === 'COMPLETED') {
      // Golden star / checkmark
      ctx.save();
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(0, badgeY + 2, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✓', 0, badgeY + 2);
      ctx.restore();
    } else if (status === 'ERROR') {
      // Warning hazard triangle
      ctx.save();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(0, badgeY + 2, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', 0, badgeY + 2);
      ctx.restore();
    } else if (status === 'COMMUNICATING') {
      // Chat bubble
      ctx.save();
      ctx.fillStyle = '#8b5cf6';
      ctx.beginPath();
      ctx.arc(0, badgeY + 2, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💬', 0, badgeY + 2);
      ctx.restore();
    }

    // 9. Floating Speech Bubble (in-world message!)
    if (agent.speechBubble && agent.speechBubble.expiresAt > Date.now()) {
      const bubbleText = agent.speechBubble.text;
      ctx.save();
      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
      const textMetrics = ctx.measureText(bubbleText);
      const textWidth = Math.min(220, Math.max(70, textMetrics.width));
      const bubbleWidth = textWidth + 18;
      const bubbleHeight = 24;
      const speechBubbleY = -48 + bobY;

      // Bubble background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.strokeStyle = agent.avatar.accentColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-bubbleWidth / 2, speechBubbleY - bubbleHeight, bubbleWidth, bubbleHeight, 6);
      ctx.fill();
      ctx.stroke();

      // Tail
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.beginPath();
      ctx.moveTo(-4, speechBubbleY);
      ctx.lineTo(0, speechBubbleY + 5);
      ctx.lineTo(4, speechBubbleY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Speech text
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let displayText = bubbleText;
      if (bubbleText.length > 28) {
        displayText = bubbleText.substring(0, 26) + '...';
      }
      ctx.fillText(displayText, 0, speechBubbleY - bubbleHeight / 2);
      ctx.restore();
    }

    // 10. Agent Name Tag & Role symbol
    ctx.save();
    ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
    const tagWidth = ctx.measureText(`${agent.roleSymbol} ${agent.name}`).width + 12;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(-tagWidth / 2, 14, tagWidth, 16, 4);
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#38bdf8' : 'rgba(148, 163, 184, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = isSelected ? '#38bdf8' : '#e2e8f0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${agent.roleSymbol} ${agent.name}`, 0, 22);
    ctx.restore();

    ctx.restore(); // Restore main agent translate
  }
}

type Canvas2DContext = CanvasRenderingContext2D;
