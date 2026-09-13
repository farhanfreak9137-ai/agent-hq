import React, { useState, useEffect, useMemo } from 'react';
import { EventBus } from '../events/EventBus.ts';

export interface TimelineEntry {
  id: string;
  timeStr: string;
  timestamp: number;
  type: string;
  actor: string;
  message: string;
  severity: 'info' | 'success' | 'warn' | 'error' | 'approval';
}

/**
 * EventTimeline displays a live chronological stream of real multi-agent execution events.
 */
export const EventTimeline: React.FC<{ maxItems?: number }> = ({ maxItems = 50 }) => {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);

  useEffect(() => {
    const unsub = EventBus.on('*', (ev: any) => {
      // Filter out high-frequency position/render events
      if (ev.type.startsWith('simulation.tick') || ev.type.startsWith('agent.moved')) {
        return;
      }

      const d = new Date(ev.timestamp || Date.now());
      const timeStr = d.toTimeString().split(' ')[0] + '.' + String(d.getMilliseconds()).padStart(3, '0').slice(0, 2);

      let actor = 'SYSTEM';
      if (ev.agentId) actor = String(ev.agentId).toUpperCase();
      else if (ev.sourceAgentId) actor = String(ev.sourceAgentId).toUpperCase();
      else if (ev.type.startsWith('orchestration')) actor = 'BOSS';

      let severity: TimelineEntry['severity'] = 'info';
      if (ev.type.includes('completed') || ev.type.includes('approved') || ev.type.includes('granted')) {
        severity = 'success';
      } else if (ev.type.includes('failed') || ev.type.includes('error') || ev.type.includes('rejected')) {
        severity = 'error';
      } else if (ev.type.includes('blocked') || ev.type.includes('warning') || ev.type.includes('cycle_limit')) {
        severity = 'warn';
      } else if (ev.type.includes('approval.requested')) {
        severity = 'approval';
      }

      const newEntry: TimelineEntry = {
        id: ev.id || `tl_${Date.now()}_${Math.random()}`,
        timeStr,
        timestamp: ev.timestamp || Date.now(),
        type: ev.type,
        actor,
        message: ev.message || ev.content || JSON.stringify(ev).substring(0, 60),
        severity,
      };

      setEntries((prev) => [newEntry, ...prev].slice(0, maxItems));
    });

    return unsub;
  }, [maxItems]);

  return (
    <div className="flex flex-col h-full bg-slate-900/80 border border-slate-800 rounded-lg overflow-hidden text-xs">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-950/70 border-b border-slate-800 font-medium text-slate-300">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Live Event Timeline
        </span>
        <span className="text-[10px] text-slate-500">{entries.length} events logged</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 font-mono">
        {entries.length === 0 ? (
          <div className="text-slate-500 italic p-3 text-center">Awaiting execution telemetry events...</div>
        ) : (
          entries.map((item) => (
            <div
              key={item.id}
              className={`p-1.5 rounded flex items-start gap-2 transition-colors ${
                item.severity === 'success'
                  ? 'bg-emerald-950/30 border-l-2 border-emerald-500 text-emerald-200'
                  : item.severity === 'error'
                  ? 'bg-rose-950/30 border-l-2 border-rose-500 text-rose-200'
                  : item.severity === 'warn'
                  ? 'bg-amber-950/30 border-l-2 border-amber-500 text-amber-200'
                  : item.severity === 'approval'
                  ? 'bg-purple-950/30 border-l-2 border-purple-500 text-purple-200'
                  : 'bg-slate-800/40 border-l-2 border-cyan-500 text-slate-300'
              }`}
            >
              <span className="text-slate-500 text-[10px] shrink-0">{item.timeStr}</span>
              <span className="px-1 py-0.5 rounded text-[9px] font-semibold tracking-wider bg-slate-800 shrink-0">
                {item.actor}
              </span>
              <span className="flex-1 break-words leading-tight">{item.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
