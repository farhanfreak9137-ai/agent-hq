import Database from 'better-sqlite3';

export interface NotificationSettings {
  id: string;
  channel: 'discord' | 'none';
  discord_webhook_url: string;
  is_enabled: number;
  poll_interval_minutes: number;
  updated_at: number;
}

export interface AlertPayload {
  title: string;
  message: string;
  company?: string;
  role?: string;
  intent?: 'interview_invite' | 'question' | 'rejection' | 'general';
  fromEmail?: string;
  actionUrl?: string;
}

export class NotificationService {
  /**
   * Retrieves notification settings from database.
   */
  static getConfig(db: Database.Database): NotificationSettings {
    const row = db.prepare('SELECT * FROM notification_settings WHERE id = ?').get('notifications_master') as NotificationSettings | undefined;
    if (row) {
      return row;
    }
    const now = Date.now();
    const defaults: NotificationSettings = {
      id: 'notifications_master',
      channel: 'discord',
      discord_webhook_url: '',
      is_enabled: 1,
      poll_interval_minutes: 5,
      updated_at: now,
    };
    db.prepare(`
      INSERT OR IGNORE INTO notification_settings (id, channel, discord_webhook_url, is_enabled, poll_interval_minutes, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      defaults.id,
      defaults.channel,
      defaults.discord_webhook_url,
      defaults.is_enabled,
      defaults.poll_interval_minutes,
      defaults.updated_at
    );
    return defaults;
  }

  /**
   * Updates notification settings in database.
   */
  static updateConfig(
    db: Database.Database,
    updates: Partial<NotificationSettings>
  ): NotificationSettings {
    const current = this.getConfig(db);
    const updated: NotificationSettings = {
      ...current,
      channel: updates.channel !== undefined ? updates.channel : current.channel,
      discord_webhook_url: updates.discord_webhook_url !== undefined ? updates.discord_webhook_url.trim() : current.discord_webhook_url,
      is_enabled: updates.is_enabled !== undefined ? (updates.is_enabled ? 1 : 0) : current.is_enabled,
      poll_interval_minutes: updates.poll_interval_minutes !== undefined ? Number(updates.poll_interval_minutes) : current.poll_interval_minutes,
      updated_at: Date.now(),
    };

    db.prepare(`
      UPDATE notification_settings
      SET channel = ?, discord_webhook_url = ?, is_enabled = ?, poll_interval_minutes = ?, updated_at = ?
      WHERE id = ?
    `).run(
      updated.channel,
      updated.discord_webhook_url,
      updated.is_enabled,
      updated.poll_interval_minutes,
      updated.updated_at,
      'notifications_master'
    );

    return updated;
  }

  /**
   * Sends a formatted Discord webhook notification.
   */
  static async sendDiscordWebhook(webhookUrl: string, alert: AlertPayload): Promise<{ success: boolean; error?: string }> {
    if (!webhookUrl || !webhookUrl.startsWith('http')) {
      return { success: false, error: 'Invalid or missing Discord webhook URL' };
    }

    let embedColor = 0x38bdf8; // Cyan default
    let intentEmoji = '📨';
    let intentLabel = 'General Message';

    if (alert.intent === 'interview_invite') {
      embedColor = 0x10b981; // Green
      intentEmoji = '🎉 INTERVIEW INVITATION';
      intentLabel = 'Interview Request';
    } else if (alert.intent === 'question') {
      embedColor = 0xf59e0b; // Amber
      intentEmoji = '❓ QUESTION / TECHNICAL INQUIRY';
      intentLabel = 'Question from Recruiter';
    } else if (alert.intent === 'rejection') {
      embedColor = 0xef4444; // Red
      intentEmoji = '📋 REJECTION / STATUS UPDATE';
      intentLabel = 'Status Update';
    }

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [];
    if (alert.company) {
      fields.push({ name: '🏢 Company', value: alert.company, inline: true });
    }
    if (alert.role) {
      fields.push({ name: '💼 Position', value: alert.role, inline: true });
    }
    if (alert.fromEmail) {
      fields.push({ name: '👤 From', value: alert.fromEmail, inline: true });
    }

    const payload = {
      username: 'Agent HQ Alerts',
      avatar_url: 'https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/mail-check.png',
      content: alert.intent === 'interview_invite' ? '🚨 **HIGH PRIORITY RECRUITER ALERT** 🚨' : undefined,
      embeds: [
        {
          title: `${intentEmoji}: ${alert.title}`,
          description: alert.message.length > 2000 ? alert.message.substring(0, 1990) + '...' : alert.message,
          color: embedColor,
          fields,
          footer: {
            text: `Agent HQ Autonomous Reply Engine • ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        return { success: false, error: `Discord HTTP ${response.status}: ${errorText}` };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  /**
   * Dispatches an alert through the configured channel.
   */
  static async sendAlert(db: Database.Database, alert: AlertPayload): Promise<{ success: boolean; error?: string }> {
    const config = this.getConfig(db);
    if (!config.is_enabled || config.channel === 'none') {
      return { success: true }; // Notifications muted
    }

    if (config.channel === 'discord' && config.discord_webhook_url) {
      return await this.sendDiscordWebhook(config.discord_webhook_url, alert);
    }

    return { success: false, error: 'No active notification channel configured' };
  }

  /**
   * Tests phone alert by sending a verification ping to Discord.
   */
  static async testAlert(db: Database.Database): Promise<{ success: boolean; message: string }> {
    const config = this.getConfig(db);
    if (!config.discord_webhook_url) {
      return {
        success: false,
        message: 'Discord Webhook URL is missing. Please paste your Discord channel webhook URL.',
      };
    }

    const res = await this.sendDiscordWebhook(config.discord_webhook_url, {
      title: 'Agent HQ Discord Webhook Connected!',
      message: 'Hello Farhan! Your phone alert system in Agent HQ is working. Whenever a company or recruiter replies to your job applications, you will receive an instant notification here with the drafted reply.',
      company: 'Synthesia (Example)',
      role: 'Senior AI Full-Stack Engineer',
      intent: 'interview_invite',
      fromEmail: 'careers@synthesia.io',
    });

    if (res.success) {
      return {
        success: true,
        message: 'Test notification sent to Discord! Check your Discord channel / phone app.',
      };
    } else {
      return {
        success: false,
        message: `Discord delivery failed: ${res.error}`,
      };
    }
  }
}
