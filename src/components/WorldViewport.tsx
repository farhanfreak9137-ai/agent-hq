import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Compass, Sparkles, X } from 'lucide-react';
import { AgentModel, RoomModel } from '../types/index.ts';
import { OfficeWorld } from '../world/OfficeWorld.ts';
import { Camera } from '../world/Camera.ts';
import { SimulationEngine } from '../simulation/SimulationEngine.ts';

interface WorldViewportProps {
  agents: AgentModel[];
  selectedAgentId: string | null;
  onSelectAgent: (agent: AgentModel | null) => void;
  simulationEngine: SimulationEngine;
  officeWorld: OfficeWorld;
  camera: Camera;
}

export const WorldViewport: React.FC<WorldViewportProps> = ({
  agents,
  selectedAgentId,
  onSelectAgent,
  simulationEngine,
  officeWorld,
  camera,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [hoveredAgent, setHoveredAgent] = useState<AgentModel | null>(null);
  const [hoveredRoom, setHoveredRoom] = useState<RoomModel | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  const dragOriginRef = useRef<{ x: number; y: number; moved: boolean }>({ x: 0, y: 0, moved: false });

  // Handle ResizeObserver for canvas
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          canvas.width = width * window.devicePixelRatio;
          canvas.height = height * window.devicePixelRatio;
          canvas.style.width = `${width}px`;
          canvas.style.height = `${height}px`;
          camera.updateViewport(width, height);
        }
      }
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, [camera]);

  // Main Render & Simulation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animFrameId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const delta = Math.min(64, currentTime - lastTime);
      lastTime = currentTime;

      // Update simulation logic
      simulationEngine.update(delta);

      // Update world animations (particles, envelopes)
      officeWorld.update(delta, simulationEngine.isPlaying ? simulationEngine.speed : 0);

      // Smooth camera interpolation
      camera.update();

      // Render world
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.save();
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        officeWorld.render(ctx, camera, agents, currentTime, {
          selectedAgentId,
          hoveredAgentId: hoveredAgent ? hoveredAgent.id : null,
          hoveredRoomId: hoveredRoom ? hoveredRoom.id : null,
          showMinimap: true,
        });
        ctx.restore();
      }

      animFrameId = requestAnimationFrame(loop);
    };

    animFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameId);
  }, [agents, camera, hoveredAgent, hoveredRoom, officeWorld, selectedAgentId, simulationEngine]);

  // Mouse Handlers for Camera Pan & Interaction
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    dragOriginRef.current = { x, y, moved: false };
    camera.startDrag(x, y);
  }, [camera]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    setCursorPos({ x: screenX, y: screenY });

    if (camera.isDragging) {
      const dist = Math.hypot(screenX - dragOriginRef.current.x, screenY - dragOriginRef.current.y);
      if (dist > 4) {
        dragOriginRef.current.moved = true;
      }
      camera.onDrag(screenX, screenY);
    } else {
      // Hover test
      const worldPos = camera.screenToWorld(screenX, screenY);
      const agent = officeWorld.getAgentAt(worldPos, agents, 22);
      setHoveredAgent(agent);

      if (!agent) {
        const room = officeWorld.getRoomAt(worldPos);
        setHoveredRoom(room);
      } else {
        setHoveredRoom(null);
      }
    }
  }, [agents, camera, officeWorld]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    camera.endDrag();

    // If it was a click (not dragged), select target
    if (!dragOriginRef.current.moved) {
      const worldPos = camera.screenToWorld(screenX, screenY);
      const clickedAgent = officeWorld.getAgentAt(worldPos, agents, 24);

      if (clickedAgent) {
        onSelectAgent(clickedAgent);
      } else {
        // Check if minimap clicked
        const mapW = 160;
        const mapH = 110;
        const pad = 16;
        const mx = camera.viewportWidth - mapW - pad;
        const my = camera.viewportHeight - mapH - pad;

        if (screenX >= mx && screenX <= mx + mapW && screenY >= my && screenY <= my + mapH) {
          const clickRelX = (screenX - mx) / mapW;
          const clickRelY = (screenY - my) / mapH;
          camera.focusOnPosition({
            x: clickRelX * officeWorld.width,
            y: clickRelY * officeWorld.height,
          });
        } else {
          // Click on empty space deselects or selects room
          const clickedRoom = officeWorld.getRoomAt(worldPos);
          if (!clickedRoom) {
            onSelectAgent(null);
          }
        }
      }
    }
  }, [agents, camera, officeWorld, onSelectAgent]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    camera.zoomBy(e.deltaY, { x: screenX, y: screenY });
  }, [camera]);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-slate-950 select-none">
      {/* 2D HTML5 World Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        className={`w-full h-full block ${
          camera.isDragging
            ? 'cursor-grabbing'
            : hoveredAgent
            ? 'cursor-pointer'
            : 'cursor-grab'
        }`}
      />

      {/* Floating Canvas Camera Controls (Top Right) */}
      <div className="absolute top-4 right-4 flex flex-col gap-1.5 z-10">
        <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-lg p-1 flex flex-col gap-1 shadow-xl">
          <button
            onClick={() => camera.zoomBy(-180)}
            title="Zoom In"
            className="p-2 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => camera.zoomBy(180)}
            title="Zoom Out"
            className="p-2 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="h-px bg-slate-800 my-0.5" />
          <button
            onClick={() => camera.centerOnWorld()}
            title="Center Office Campus"
            className="p-2 rounded hover:bg-slate-800 text-cyan-400 hover:text-cyan-300 transition"
          >
            <Compass className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Hover Info Tooltip */}
      {hoveredAgent && cursorPos && (
        <div
          className="pointer-events-none absolute z-20 px-2.5 py-1.5 rounded bg-slate-900/95 border border-cyan-500/40 text-xs shadow-xl backdrop-blur"
          style={{
            left: `${cursorPos.x + 14}px`,
            top: `${cursorPos.y + 14}px`,
          }}
        >
          <div className="flex items-center gap-1.5 font-bold text-slate-100">
            <span>{hoveredAgent.roleSymbol}</span>
            <span>{hoveredAgent.name}</span>
            <span className="text-[10px] font-normal text-cyan-400 uppercase font-mono">
              ({hoveredAgent.role})
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
            Status: <span className="text-emerald-400 font-semibold">{hoveredAgent.status}</span>
          </div>
          {hoveredAgent.statusMessage && (
            <div className="text-[10px] text-slate-300 italic max-w-xs mt-0.5">
              "{hoveredAgent.statusMessage}"
            </div>
          )}
        </div>
      )}

      {/* Selected Agent Quick Pill (Bottom Center) */}
      {selectedAgent && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 px-3.5 py-2 rounded-full bg-slate-900/90 backdrop-blur border border-cyan-500/50 shadow-2xl">
          <div className="flex items-center gap-2">
            <span className="text-base">{selectedAgent.roleSymbol}</span>
            <div>
              <span className="text-xs font-bold text-slate-100 mr-1.5">{selectedAgent.name}</span>
              <span className="text-[10px] text-cyan-400 font-mono px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800">
                {selectedAgent.status}
              </span>
            </div>
          </div>

          <button
            onClick={() => camera.focusOnPosition(selectedAgent.currentPosition, 1.35)}
            className="px-2.5 py-1 text-[11px] font-medium rounded-full bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 transition"
          >
            Focus Camera
          </button>

          <button
            onClick={() => onSelectAgent(null)}
            title="Deselect"
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
