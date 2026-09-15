import { RoomModel } from '../types/index.ts';

export const ROOMS_DATA: RoomModel[] = [
  // 1. COMMAND ROOM (BOSS)
  {
    id: 'room_command',
    name: 'Command Deck',
    type: 'command',
    x: 550,
    y: 50,
    width: 420,
    height: 250,
    colorTheme: '#3b82f6', // blue
    doorway: { x: 760, y: 300 },
    deskPositions: [
      { agentId: 'boss', pos: { x: 760, y: 155 }, facing: 'down' },
      { agentId: 'strategist', pos: { x: 630, y: 155 }, facing: 'down' },
    ],
    props: [
      { id: 'p_boss_screen', type: 'hologram_table', x: 760, y: 205, width: 90, height: 40, glowColor: '#38bdf8' },
      { id: 'p_boss_desk', type: 'desk', x: 760, y: 130, width: 110, height: 45, glowColor: '#60a5fa' },
      { id: 'p_strat_desk', type: 'desk', x: 630, y: 130, width: 80, height: 45, glowColor: '#c084fc' },
      { id: 'p_boss_plant_l', type: 'plant', x: 580, y: 80, width: 30, height: 30 },
      { id: 'p_boss_plant_r', type: 'plant', x: 940, y: 80, width: 30, height: 30 },
      { id: 'p_boss_shelf', type: 'bookshelf', x: 610, y: 70, width: 70, height: 30 },
    ],
  },

  // 2. CODING ROOM (NOVA)
  {
    id: 'room_coding',
    name: 'Dev Studio',
    type: 'coding',
    x: 50,
    y: 50,
    width: 430,
    height: 250,
    colorTheme: '#10b981', // emerald
    doorway: { x: 480, y: 175 },
    deskPositions: [
      { agentId: 'nova', pos: { x: 260, y: 160 }, facing: 'up' },
    ],
    props: [
      { id: 'p_nova_desk', type: 'desk', x: 260, y: 175, width: 110, height: 45, glowColor: '#34d399' },
      { id: 'p_nova_monitors', type: 'dual_monitors', x: 260, y: 195, width: 70, height: 25, glowColor: '#10b981' },
      { id: 'p_nova_server', type: 'server_rack', x: 90, y: 90, width: 50, height: 90, glowColor: '#059669' },
      { id: 'p_nova_plant', type: 'plant', x: 440, y: 80, width: 30, height: 30 },
      { id: 'p_nova_whiteboard', type: 'whiteboard', x: 260, y: 70, width: 100, height: 20 },
    ],
  },

  // 3. SECURITY ROOM (SENTINEL)
  {
    id: 'room_security',
    name: 'Sec-Ops Lab',
    type: 'security',
    x: 1040,
    y: 50,
    width: 430,
    height: 250,
    colorTheme: '#ef4444', // red
    doorway: { x: 1040, y: 175 },
    deskPositions: [
      { agentId: 'sentinel', pos: { x: 1250, y: 160 }, facing: 'up' },
    ],
    props: [
      { id: 'p_sentinel_desk', type: 'desk', x: 1250, y: 175, width: 110, height: 45, glowColor: '#f87171' },
      { id: 'p_sentinel_monitors', type: 'dual_monitors', x: 1250, y: 195, width: 80, height: 25, glowColor: '#ef4444' },
      { id: 'p_sentinel_servers', type: 'server_rack', x: 1420, y: 90, width: 40, height: 100, glowColor: '#dc2626' },
      { id: 'p_sentinel_radar', type: 'whiteboard', x: 1250, y: 70, width: 90, height: 20 },
    ],
  },

  // 4. DESIGN ROOM (PIXEL)
  {
    id: 'room_design',
    name: 'Design Studio',
    type: 'design',
    x: 50,
    y: 380,
    width: 430,
    height: 250,
    colorTheme: '#f59e0b', // amber / violet
    doorway: { x: 480, y: 505 },
    deskPositions: [
      { agentId: 'pixel', pos: { x: 260, y: 490 }, facing: 'up' },
    ],
    props: [
      { id: 'p_pixel_desk', type: 'desk', x: 260, y: 505, width: 110, height: 45, glowColor: '#fbbf24' },
      { id: 'p_pixel_monitors', type: 'dual_monitors', x: 260, y: 525, width: 75, height: 25, glowColor: '#f59e0b' },
      { id: 'p_pixel_couch', type: 'couch', x: 100, y: 560, width: 70, height: 35 },
      { id: 'p_pixel_whiteboard', type: 'whiteboard', x: 260, y: 400, width: 110, height: 20 },
      { id: 'p_pixel_plant', type: 'plant', x: 440, y: 410, width: 30, height: 30 },
    ],
  },

  // 5. COMMON AREA (LOUNGE & COMMONS)
  {
    id: 'room_common',
    name: 'Commons Lounge',
    type: 'common',
    x: 550,
    y: 380,
    width: 420,
    height: 250,
    colorTheme: '#06b6d4', // cyan
    doorway: { x: 760, y: 380 },
    deskPositions: [
      { agentId: 'crm', pos: { x: 650, y: 490 }, facing: 'up' },
      { agentId: 'outreach', pos: { x: 870, y: 490 }, facing: 'up' },
    ],
    props: [
      { id: 'p_crm_desk', type: 'desk', x: 650, y: 505, width: 80, height: 40, glowColor: '#34d399' },
      { id: 'p_outreach_desk', type: 'desk', x: 870, y: 505, width: 80, height: 40, glowColor: '#38bdf8' },
      { id: 'p_lounge_table', type: 'coffee_table', x: 760, y: 505, width: 80, height: 50 },
      { id: 'p_lounge_water', type: 'water_cooler', x: 590, y: 410, width: 25, height: 40, glowColor: '#38bdf8' },
      { id: 'p_lounge_vending', type: 'vending_machine', x: 920, y: 410, width: 45, height: 60, glowColor: '#a855f7' },
      { id: 'p_lounge_plant_1', type: 'plant', x: 590, y: 590, width: 30, height: 30 },
      { id: 'p_lounge_plant_2', type: 'plant', x: 930, y: 590, width: 30, height: 30 },
    ],
  },

  // 6. TESTING ROOM (VECTOR)
  {
    id: 'room_testing',
    name: 'QA & Testing Chamber',
    type: 'testing',
    x: 1040,
    y: 380,
    width: 430,
    height: 250,
    colorTheme: '#8b5cf6', // purple
    doorway: { x: 1040, y: 505 },
    deskPositions: [
      { agentId: 'vector', pos: { x: 1250, y: 490 }, facing: 'up' },
    ],
    props: [
      { id: 'p_vector_desk', type: 'desk', x: 1250, y: 505, width: 110, height: 45, glowColor: '#a78bfa' },
      { id: 'p_vector_monitors', type: 'dual_monitors', x: 1250, y: 525, width: 75, height: 25, glowColor: '#8b5cf6' },
      { id: 'p_vector_servers', type: 'server_rack', x: 1420, y: 420, width: 40, height: 90, glowColor: '#7c3aed' },
      { id: 'p_vector_board', type: 'whiteboard', x: 1250, y: 400, width: 90, height: 20 },
      { id: 'p_vector_plant', type: 'plant', x: 1080, y: 410, width: 30, height: 30 },
    ],
  },

  // 7. RESEARCH ROOM (ATLAS)
  {
    id: 'room_research',
    name: 'Intelligence Lab',
    type: 'research',
    x: 50,
    y: 710,
    width: 430,
    height: 250,
    colorTheme: '#0ea5e9', // sky blue
    doorway: { x: 480, y: 835 },
    deskPositions: [
      { agentId: 'atlas', pos: { x: 260, y: 820 }, facing: 'up' },
    ],
    props: [
      { id: 'p_atlas_desk', type: 'desk', x: 260, y: 835, width: 110, height: 45, glowColor: '#38bdf8' },
      { id: 'p_atlas_monitors', type: 'dual_monitors', x: 260, y: 855, width: 75, height: 25, glowColor: '#0ea5e9' },
      { id: 'p_atlas_shelf_1', type: 'bookshelf', x: 90, y: 740, width: 70, height: 30 },
      { id: 'p_atlas_shelf_2', type: 'bookshelf', x: 170, y: 740, width: 70, height: 30 },
      { id: 'p_atlas_couch', type: 'couch', x: 90, y: 890, width: 70, height: 35 },
      { id: 'p_atlas_plant', type: 'plant', x: 440, y: 740, width: 30, height: 30 },
    ],
  },

  // 8. REVIEW ROOM (ECHO)
  {
    id: 'room_review',
    name: 'Code Review Vault',
    type: 'testing',
    x: 1040,
    y: 710,
    width: 430,
    height: 250,
    colorTheme: '#14b8a6', // teal
    doorway: { x: 1040, y: 835 },
    deskPositions: [
      { agentId: 'echo', pos: { x: 1250, y: 820 }, facing: 'up' },
    ],
    props: [
      { id: 'p_echo_desk', type: 'desk', x: 1250, y: 835, width: 110, height: 45, glowColor: '#2dd4bf' },
      { id: 'p_echo_monitors', type: 'dual_monitors', x: 1250, y: 855, width: 75, height: 25, glowColor: '#14b8a6' },
      { id: 'p_echo_shelf', type: 'bookshelf', x: 1370, y: 740, width: 70, height: 30 },
      { id: 'p_echo_whiteboard', type: 'whiteboard', x: 1250, y: 730, width: 100, height: 20 },
      { id: 'p_echo_plant', type: 'plant', x: 1080, y: 740, width: 30, height: 30 },
    ],
  },

  // 9. WRITER'S STUDY & ARCHIVE (QUILL)
  {
    id: 'room_core',
    name: "Writer's Study & Archive",
    type: 'research',
    x: 550,
    y: 710,
    width: 420,
    height: 250,
    colorTheme: '#d97706', // warm amber / gold
    doorway: { x: 760, y: 710 },
    deskPositions: [
      { agentId: 'quill', pos: { x: 760, y: 825 }, facing: 'up' },
    ],
    props: [
      { id: 'p_quill_desk', type: 'desk', x: 760, y: 840, width: 110, height: 45, glowColor: '#f59e0b' },
      { id: 'p_quill_monitors', type: 'dual_monitors', x: 760, y: 860, width: 75, height: 25, glowColor: '#fbbf24' },
      { id: 'p_quill_shelf_l', type: 'bookshelf', x: 590, y: 740, width: 70, height: 30 },
      { id: 'p_quill_shelf_r', type: 'bookshelf', x: 900, y: 740, width: 70, height: 30 },
      { id: 'p_quill_couch', type: 'couch', x: 670, y: 890, width: 70, height: 35 },
      { id: 'p_quill_plant_1', type: 'plant', x: 590, y: 890, width: 30, height: 30 },
      { id: 'p_quill_plant_2', type: 'plant', x: 920, y: 890, width: 30, height: 30 },
    ],
  },
];
