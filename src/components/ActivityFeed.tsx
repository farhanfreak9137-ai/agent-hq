import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Terminal,
  MessageSquare,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  Filter,
  Wrench,
  Brain,
  Activity,
  PlayCircle
} from 'lucide-react';
import { EventBus } from '../events/EventBus.ts';
import { SimulationEvent } from '../events/EventTypes.ts';

interface ActivityFeedProps {
  onFocusAgentById?: (agentId: string) => void;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ onFocusAgentById }) => {
  const [events, setEvents] = useState<SimulationEvent[]>([]);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [filter, setFilter] = useState<'all' | 'runtime' | 'task' | 'message' | 'mission'>('all');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Initial history
    setEvents(EventBus.getHistory().slice(0, 80));

    // Listen to all events
    const unsub = EventBus.on('*', (ev) => {
      setEvents((prev) => [ev, ...prev].slice(0, 100));
    });

    return unsub;
  }, []);

  const filteredEvents = events.filter((ev) => {
    if (filter === 'all') return true;
    if (filter === 'runtime') return ev.type.startsWith('runtime.');
    if (filter === 'task') return ev.type.startsWith('task.') || ev.type.startsWith('agent.task');
    if (filter === 'message') return ev.type.includes('message');
    if (filter === 'mission') return ev.type.startsWith('mission');
    return true;
  });

  const getEventIcon = (type: string) => {
    if (type.startsWith('mission')) {
      return <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
    }
    if (type.includes('failed') || type.includes('error')) {
      return <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
    }
    if (type.includes('completed')) {
      return <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    }
    if (type.includes('tool')) {
      return <Wrench className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    }
    if (type.includes('thinking')) {
      return <Brain className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
    }
    if (type.includes('progress')) {
      return <Activity className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
    }
    if (type.includes('started')) {
      return <PlayCircle className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
    }
    if (type.includes('message')) {
      return <MessageSquare className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
    }
    if (type.includes('task')) {
      return <Terminal className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
    }
    return <Terminal className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div
      className={`fixed bottom-4 left-4 z-20 w-80 md:w-96 rounded-xl bg-slate-950/92 backdrop-blur-md border border-slate-800 shadow-2xl transition-all duration-300 overflow-hidden flex flex-col ${
        isExpanded ? 'h-72' : 'h-11'
      }`}
    >
      {/* Header bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="h-11 px-3.5 bg-slate-900/80 border-b border-slate-800/80 flex items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Live Activity Feed
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300">
            {filteredEvents.length}
          </span>
        </div>

        <button className="text-slate-400 hover:text-slate-200">
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {isExpanded && (
        <>
          {/* Filter Pills */}
          <div className="px-3 py-1.5 bg-slate-900/40 border-b border-slate-800/60 flex items-center gap-1 overflow-x-auto text-[10px] font-medium text-slate-400">
            <Filter className="w-3 h-3 text-slate-500 mr-1 shrink-0" />
            {(['all', 'runtime', 'task', 'message', 'mission'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-0.5 rounded capitalize transition ${
                  filter === f
                    ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30'
                    : 'hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Event Stream list */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-2.5 space-y-1.5 font-mono text-xs">
            {filteredEvents.length === 0 ? (
              <div className="text-center py-8 text-slate-600 text-xs">No events recorded yet.</div>
            ) : (
              filteredEvents.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => {
                    const agentId = (ev as any).agentId || (ev as any).sourceAgentId || (ev as any).targetAgentId;
                    if (agentId) onFocusAgentById(agentId);
                  }}
                  className={`p-1.5 rounded-lg bg-slate-900/50 hover:bg-slate-900 border border-slate-800/60 flex items-start gap-2 transition ${
                    ((ev as any).agentId || (ev as any).sourceAgentId || (ev as any).targetAgentId) ? 'cursor-pointer hover:border-cyan-500/50' : ''
                  }`}
                >
                  {getEventIcon(ev.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span className="font-semibold text-slate-400 uppercase tracking-tight">
                        {ev.type.replace('agent.', '').replace('simulation.', '').replace('_', ' ')}
                      </span>
                      <span>{formatTime(ev.timestamp)}</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug break-words mt-0.5">
                      {ev.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};
