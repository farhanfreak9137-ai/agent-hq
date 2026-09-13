import { MessageModel } from '../types/index.ts';
import { EventBus } from '../events/EventBus.ts';
import { AgentManager } from '../agents/AgentManager.ts';
import { generateId } from '../utils/id.ts';
import { ApiClient } from '../services/ApiClient.ts';

class MessageBusClass {
  private messages: MessageModel[] = [];
  private readonly maxMessages = 200;
  private apiClient: ApiClient = ApiClient.getInstance();

  constructor() {
    this.loadFromStorage();
    this.loadFromServer();
  }

  public async loadFromServer(): Promise<void> {
    try {
      const serverMsgs = await this.apiClient.getMessages();
      if (serverMsgs && Array.isArray(serverMsgs) && serverMsgs.length > 0) {
        const mapped: MessageModel[] = serverMsgs.map((sm: any) => ({
          id: sm.id,
          fromAgentId: sm.source_agent_id,
          toAgentId: sm.target_agent_id,
          content: sm.content,
          timestamp: sm.timestamp,
          type: sm.type || 'general',
          taskId: sm.task_id || undefined,
          handoffData: sm.payload || undefined,
          read: true,
        }));
        // Merge without duplicating IDs
        const existingIds = new Set(this.messages.map((m) => m.id));
        for (const m of mapped) {
          if (!existingIds.has(m.id)) {
            this.messages.push(m);
            existingIds.add(m.id);
          }
        }
        this.messages.sort((a, b) => b.timestamp - a.timestamp);
        if (this.messages.length > this.maxMessages) {
          this.messages = this.messages.slice(0, this.maxMessages);
        }
      }
    } catch {
      // Offline tolerance
    }
  }

  public sendMessage(
    fromAgentId: string,
    toAgentId: string,
    content: string,
    type: MessageModel['type'] = 'general',
    taskId?: string,
    handoffData?: unknown
  ): MessageModel {
    const msg: MessageModel = {
      id: generateId('msg'),
      fromAgentId,
      toAgentId,
      content,
      timestamp: Date.now(),
      type,
      taskId,
      handoffData,
      read: false,
    };

    this.messages.unshift(msg);
    if (this.messages.length > this.maxMessages) {
      this.messages.pop();
    }

    this.saveToStorage();

    // Persist to server in background
    this.apiClient.sendMessage({
      id: msg.id,
      sourceAgentId: fromAgentId,
      targetAgentId: toAgentId,
      content,
      type,
      taskId,
      payload: handoffData as any,
    });

    const fromAgent = AgentManager.getById(fromAgentId);
    const toAgent = AgentManager.getById(toAgentId);

    // Emit structured message event for visualization and tracking
    EventBus.emit({
      id: generateId('ev'),
      type: 'agent.message_sent',
      timestamp: Date.now(),
      sourceAgentId: fromAgentId,
      targetAgentId: toAgentId,
      content,
      messageData: msg,
      sourcePosition: fromAgent ? { ...fromAgent.currentPosition } : undefined,
      targetPosition: toAgent ? { ...toAgent.currentPosition } : undefined,
      accentColor: fromAgent?.avatar.accentColor || '#38bdf8',
      message: `${fromAgent ? fromAgent.name : fromAgentId} → ${
        toAgent ? toAgent.name : toAgentId
      }: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
    });

    // Notify recipient runtime via EventBus
    EventBus.emit({
      id: generateId('ev'),
      type: 'agent.message_received',
      timestamp: Date.now(),
      sourceAgentId: fromAgentId,
      targetAgentId: toAgentId,
      content,
      messageData: msg,
      message: `${toAgent ? toAgent.name : toAgentId} received message from ${
        fromAgent ? fromAgent.name : fromAgentId
      }`,
    });

    return msg;
  }

  public getMessagesForAgent(agentId: string): MessageModel[] {
    return this.messages.filter(
      (m) => m.fromAgentId === agentId || m.toAgentId === agentId
    );
  }

  public getHistory(agentId?: string): MessageModel[] {
    return agentId ? this.getMessagesForAgent(agentId) : this.getAllMessages();
  }

  public getAllMessages(): MessageModel[] {
    return [...this.messages];
  }

  public clear(): void {
    this.messages = [];
    this.saveToStorage();
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem('agent_hq_messages', JSON.stringify(this.messages.slice(0, 50)));
    } catch {
      // ignore
    }
  }

  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem('agent_hq_messages');
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          this.messages = parsed;
          return;
        }
      }
      this.messages = [];
    } catch {
      this.messages = [];
    }
  }
}

export const MessageBus = new MessageBusClass();
