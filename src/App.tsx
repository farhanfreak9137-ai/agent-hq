import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AgentModel, TaskModel } from './types/index.ts';
import { AgentManager } from './agents/AgentManager.ts';
import { TaskManager } from './tasks/TaskManager.ts';
import { EventBus } from './events/EventBus.ts';
import { MissionStartedEvent, MissionStepEvent } from './events/EventTypes.ts';
import { OfficeWorld } from './world/OfficeWorld.ts';
import { Camera } from './world/Camera.ts';
import { SimulationEngine } from './simulation/SimulationEngine.ts';
import { TopBar } from './components/TopBar.tsx';
import { WorldViewport } from './components/WorldViewport.tsx';
import { ActivityFeed } from './components/ActivityFeed.tsx';
import { AgentInspector } from './components/AgentInspector.tsx';
import { TaskBoardModal } from './components/TaskBoardModal.tsx';
import { CreateTaskModal } from './components/CreateTaskModal.tsx';
import { MissionDashboard } from './components/MissionDashboard.tsx';
import { ApiClient } from './services/ApiClient.ts';
import { EventStreamClient } from './services/EventStreamClient.ts';

export default function App() {
  // Core World, Camera & Simulation instances
  const officeWorld = useMemo(() => new OfficeWorld(), []);
  const camera = useMemo(() => new Camera(1200, 800), []);
  const simulationEngine = useMemo(() => new SimulationEngine(), []);

  // Reactive UI state
  const [agents, setAgents] = useState<AgentModel[]>(() => AgentManager.getAll());
  const [tasks, setTasks] = useState<TaskModel[]>(() => TaskManager.getAll());
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ username: string; role: string } | null>(null);
  const [persistenceStatus, setPersistenceStatus] = useState<string>('SQLite Synced');

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [speed, setSpeed] = useState<number>(1.0);
  const [activeMissionName, setActiveMissionName] = useState<string | null>(null);
  const [activeMissionStep, setActiveMissionStep] = useState<number>(0);
  const [totalMissionSteps, setTotalMissionSteps] = useState<number>(0);

  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState<boolean>(false);
  const [isTaskBoardOpen, setIsTaskBoardOpen] = useState<boolean>(false);
  const [isMissionDashboardOpen, setIsMissionDashboardOpen] = useState<boolean>(false);

  // Initialize SSE event stream and sync persistent state on mount
  useEffect(() => {
    EventStreamClient.getInstance().connect();

    const apiClient = ApiClient.getInstance();
    apiClient.getMe().then((res) => {
      if (res?.authenticated && res.user) {
        setCurrentUser(res.user);
      } else {
        apiClient.devLogin('ADMIN').then((devRes) => {
          if (devRes?.user) {
            setCurrentUser(devRes.user);
          }
        });
      }
    });

    apiClient.sync().then((syncRes) => {
      if (syncRes) {
        setPersistenceStatus('SQLite WAL Synced');
        setAgents([...AgentManager.getAll()]);
        setTasks([...TaskManager.getAll()]);
      } else {
        setPersistenceStatus('Local Mode');
      }
    });

    return () => {
      EventStreamClient.getInstance().disconnect();
    };
  }, []);

  // Clean up OfficeWorld subscriptions on unmount
  useEffect(() => {
    return () => {
      officeWorld.destroy();
    };
  }, [officeWorld]);

  // Sync state purely from EventBus events (Zero polling)
  useEffect(() => {
    const unsub = EventBus.on('*', (ev) => {
      // Refresh agents & tasks when their state, position, or tasks change
      if (
        ev.type.startsWith('agent.') ||
        ev.type === 'simulation.reset' ||
        ev.type.startsWith('mission.')
      ) {
        setAgents([...AgentManager.getAll()]);
        setTasks([...TaskManager.getAll()]);
      }

      // Explicit event-driven mission UI updates
      if (ev.type === 'mission.started') {
        const m = ev as MissionStartedEvent;
        setActiveMissionName(m.missionName);
        setActiveMissionStep(m.stepIndex || 1);
        setTotalMissionSteps(m.totalSteps || 8);
      } else if (ev.type === 'mission.step') {
        const m = ev as MissionStepEvent;
        setActiveMissionName(m.missionName);
        setActiveMissionStep(m.stepIndex);
        setTotalMissionSteps(m.totalSteps || 8);
      } else if (ev.type === 'mission.completed' || ev.type === 'mission.failed') {
        setActiveMissionName(null);
        setActiveMissionStep(0);
        setTotalMissionSteps(0);
      }

      if (ev.type === 'simulation.play' || ev.type === 'simulation.resumed' || ev.type === 'simulation.started') {
        setIsPlaying(true);
      } else if (ev.type === 'simulation.pause' || ev.type === 'simulation.paused') {
        setIsPlaying(false);
      } else if (ev.type === 'simulation.speed') {
        setSpeed(simulationEngine.speed);
      } else if (ev.type === 'simulation.reset') {
        setIsPlaying(true);
        setSpeed(1.0);
        setActiveMissionName(null);
        setActiveMissionStep(0);
        setTotalMissionSteps(0);
      }
    });

    return unsub;
  }, [simulationEngine]);

  const handleTogglePlay = useCallback(() => {
    simulationEngine.togglePlay();
    setIsPlaying(simulationEngine.isPlaying);
  }, [simulationEngine]);

  const handleSetSpeed = useCallback(
    (newSpeed: number) => {
      simulationEngine.setSpeed(newSpeed);
      setSpeed(newSpeed);
    },
    [simulationEngine]
  );

  const handleReset = useCallback(() => {
    simulationEngine.reset();
    setAgents([...AgentManager.getAll()]);
    setTasks([...TaskManager.getAll()]);
    setSelectedAgentId(null);
    camera.centerOnWorld();
  }, [camera, simulationEngine]);

  const handleRunDemoMission = useCallback(() => {
    simulationEngine.runDemoMission();
    // Center camera on command room
    camera.focusOnPosition({ x: 760, y: 380 }, 0.95);
  }, [camera, simulationEngine]);

  const handleSelectAgent = useCallback((agent: AgentModel | null) => {
    setSelectedAgentId(agent ? agent.id : null);
  }, []);

  const handleSelectAgentById = useCallback(
    (agentId: string) => {
      setSelectedAgentId(agentId);
      const target = AgentManager.getById(agentId);
      if (target) {
        camera.focusOnPosition(target.currentPosition, 1.35);
      }
    },
    [camera]
  );

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || null;

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-slate-950 font-sans text-slate-100 select-none">
      {/* 1. Header / Top Bar */}
      <TopBar
        agents={agents}
        tasks={tasks}
        isPlaying={isPlaying}
        speed={speed}
        activeMissionName={activeMissionName}
        activeMissionStep={activeMissionStep}
        totalMissionSteps={totalMissionSteps}
        onTogglePlay={handleTogglePlay}
        onSetSpeed={handleSetSpeed}
        onReset={handleReset}
        onRunDemoMission={handleRunDemoMission}
        onOpenCreateTask={() => setIsCreateTaskOpen(true)}
        onOpenTaskBoard={() => setIsTaskBoardOpen(true)}
        onOpenMissionDashboard={() => setIsMissionDashboardOpen(true)}
        currentUser={currentUser}
        persistenceStatus={persistenceStatus}
      />

      {/* 2. Main 2D Office World Viewport */}
      <main className="relative flex-1 w-full h-full overflow-hidden">
        <WorldViewport
          agents={agents}
          selectedAgentId={selectedAgentId}
          onSelectAgent={handleSelectAgent}
          simulationEngine={simulationEngine}
          officeWorld={officeWorld}
          camera={camera}
        />

        {/* 3. Bottom Left Activity Feed */}
        <ActivityFeed onFocusAgentById={handleSelectAgentById} />

        {/* 4. Right Side Agent Inspector */}
        <AgentInspector
          agent={selectedAgent}
          onClose={() => setSelectedAgentId(null)}
          camera={camera}
          simulationEngine={simulationEngine}
        />
      </main>

      {/* Modals */}
      <TaskBoardModal
        tasks={tasks}
        agents={agents}
        isOpen={isTaskBoardOpen}
        onClose={() => setIsTaskBoardOpen(false)}
        onOpenCreateTask={() => {
          setIsTaskBoardOpen(false);
          setIsCreateTaskOpen(true);
        }}
        onSelectAgentById={handleSelectAgentById}
      />

      <CreateTaskModal
        agents={agents}
        isOpen={isCreateTaskOpen}
        onClose={() => setIsCreateTaskOpen(false)}
        simulationEngine={simulationEngine}
      />

      <MissionDashboard
        isOpen={isMissionDashboardOpen}
        onClose={() => setIsMissionDashboardOpen(false)}
        agents={agents}
      />
    </div>
  );
}
