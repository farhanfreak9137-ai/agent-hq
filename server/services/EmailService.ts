import nodemailer from 'nodemailer';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export interface EmailIntegrationConfig {
  id: string;
  gmail_address: string;
  app_password: string;
  sender_name: string;
  stagger_delay_seconds: number;
  auto_send_enabled: number;
  updated_at: number;
}

export interface OutreachEmail {
  id: string;
  company: string;
  role: string;
  recipient_email: string;
  recipient_name?: string;
  subject: string;
  body_html: string;
  body_text: string;
  attachments?: string; // JSON array string
  status: 'staged' | 'sending' | 'sent' | 'failed';
  error_message?: string;
  sent_at?: number;
  created_at: number;
}

export class EmailService {
  /**
   * Retrieves email configuration from database.
   */
  static getConfig(db: Database.Database): EmailIntegrationConfig {
    const row = db.prepare('SELECT * FROM email_integration_config WHERE id = ?').get('gmail_master') as EmailIntegrationConfig | undefined;
    if (row) {
      return row;
    }
    const now = Date.now();
    const defaultConfig: EmailIntegrationConfig = {
      id: 'gmail_master',
      gmail_address: 'farhan.sajid1896@gmail.com',
      app_password: '',
      sender_name: 'Md Farhan Hossain',
      stagger_delay_seconds: 20,
      auto_send_enabled: 0,
      updated_at: now,
    };
    db.prepare(`
      INSERT OR IGNORE INTO email_integration_config (id, gmail_address, app_password, sender_name, stagger_delay_seconds, auto_send_enabled, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      defaultConfig.id,
      defaultConfig.gmail_address,
      defaultConfig.app_password,
      defaultConfig.sender_name,
      defaultConfig.stagger_delay_seconds,
      defaultConfig.auto_send_enabled,
      defaultConfig.updated_at
    );
    return defaultConfig;
  }

  /**
   * Updates email configuration in database.
   */
  static updateConfig(
    db: Database.Database,
    updates: Partial<EmailIntegrationConfig>
  ): EmailIntegrationConfig {
    const current = this.getConfig(db);
    const updated: EmailIntegrationConfig = {
      ...current,
      gmail_address: updates.gmail_address !== undefined ? updates.gmail_address.trim() : current.gmail_address,
      app_password: updates.app_password !== undefined ? updates.app_password.replace(/\s+/g, '') : current.app_password,
      sender_name: updates.sender_name !== undefined ? updates.sender_name.trim() : current.sender_name,
      stagger_delay_seconds: updates.stagger_delay_seconds !== undefined ? Number(updates.stagger_delay_seconds) : current.stagger_delay_seconds,
      auto_send_enabled: updates.auto_send_enabled !== undefined ? (updates.auto_send_enabled ? 1 : 0) : current.auto_send_enabled,
      updated_at: Date.now(),
    };

    db.prepare(`
      UPDATE email_integration_config
      SET gmail_address = ?, app_password = ?, sender_name = ?, stagger_delay_seconds = ?, auto_send_enabled = ?, updated_at = ?
      WHERE id = ?
    `).run(
      updated.gmail_address,
      updated.app_password,
      updated.sender_name,
      updated.stagger_delay_seconds,
      updated.auto_send_enabled,
      updated.updated_at,
      'gmail_master'
    );

    return updated;
  }

  /**
   * Creates a Nodemailer transport using Gmail SMTP.
   */
  static createTransport(config: EmailIntegrationConfig) {
    if (!config.gmail_address || !config.app_password) {
      throw new Error('Gmail address or App Password is not configured. Please set your 16-character Google App Password in settings.');
    }

    return nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: config.gmail_address,
        pass: config.app_password.replace(/\s+/g, ''),
      },
    });
  }

  /**
   * Tests the connection by verifying SMTP credentials and optionally sending a test ping email to the user.
   */
  static async testConnection(db: Database.Database): Promise<{ success: boolean; message: string }> {
    const config = this.getConfig(db);
    if (!config.gmail_address || !config.app_password) {
      return {
        success: false,
        message: 'Gmail address or App Password is missing. Please enter your Gmail and 16-character App Password.',
      };
    }

    try {
      const transporter = this.createTransport(config);
      await transporter.verify();

      // Send self test email
      await transporter.sendMail({
        from: `"${config.sender_name}" <${config.gmail_address}>`,
        to: config.gmail_address,
        subject: 'Agent HQ: Gmail Integration Verified Successfully',
        text: `Hello ${config.sender_name},\n\nYour Gmail integration in Agent HQ is working perfectly!\n\nAgents (like Outreach & Boss) can now safely send tailored job applications and outreach emails on your behalf.\n\nTimestamp: ${new Date().toISOString()}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #334155; border-radius: 12px; background: #0f172a; color: #f8fafc;">
            <h2 style="color: #38bdf8; margin-top: 0;">🚀 Agent HQ: Gmail Connected!</h2>
            <p>Hello <strong>${config.sender_name}</strong>,</p>
            <p>Your Gmail integration via Google App Password is authenticated and working properly.</p>
            <div style="background: #1e293b; padding: 14px 18px; border-radius: 8px; border-left: 4px solid #10b981; margin: 18px 0;">
              <strong>Status:</strong> Ready for Cold Outreach & Job Application Dispatch<br/>
              <strong>Anti-Spam Stagger Delay:</strong> ${config.stagger_delay_seconds} seconds between emails
            </div>
            <p style="color: #94a3b8; font-size: 13px;">Sent securely from Agent HQ Local Engine at ${new Date().toLocaleString()}</p>
          </div>
        `,
      });

      return {
        success: true,
        message: `Successfully verified and sent test email to ${config.gmail_address}! Check your inbox.`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Gmail SMTP Authentication Failed: ${err.message || String(err)}`,
      };
    }
  }

  /**
   * Resolves attachments from workspace or filesystem paths into Nodemailer attachment objects.
   */
  static resolveAttachments(attachmentsJson?: string): Array<{ filename: string; path: string }> {
    if (!attachmentsJson) return [];
    try {
      const list: string[] = typeof attachmentsJson === 'string' ? JSON.parse(attachmentsJson) : attachmentsJson;
      const workspaceDir = path.resolve(process.cwd(), 'workspace');
      const resolved = [];

      for (const item of list) {
        let fullPath = item;
        if (!path.isAbsolute(item)) {
          fullPath = path.resolve(workspaceDir, item);
          if (!fs.existsSync(fullPath)) {
            fullPath = path.resolve(process.cwd(), item);
          }
        }
        if (fs.existsSync(fullPath)) {
          resolved.push({
            filename: path.basename(fullPath),
            path: fullPath,
          });
        }
      }
      return resolved;
    } catch {
      return [];
    }
  }

  /**
   * Sends a single email record.
   */
  static async sendOutreachEmail(db: Database.Database, emailId: string): Promise<{ success: boolean; error?: string }> {
    const config = this.getConfig(db);
    const email = db.prepare('SELECT * FROM outreach_emails WHERE id = ?').get(emailId) as OutreachEmail | undefined;

    if (!email) {
      return { success: false, error: 'Email record not found' };
    }

    try {
      db.prepare("UPDATE outreach_emails SET status = 'sending', error_message = NULL WHERE id = ?").run(emailId);
      const transporter = this.createTransport(config);

      const attachments = this.resolveAttachments(email.attachments);

      await transporter.sendMail({
        from: `"${config.sender_name}" <${config.gmail_address}>`,
        to: email.recipient_email,
        subject: email.subject,
        text: email.body_text,
        html: email.body_html,
        attachments,
      });

      const now = Date.now();
      db.prepare("UPDATE outreach_emails SET status = 'sent', sent_at = ?, error_message = NULL WHERE id = ?").run(now, emailId);

      // Record in audit log and event stream
      db.prepare(`
        INSERT INTO audit_logs (id, actor_id, actor_name, action, resource, resource_id, success, metadata, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        `audit_email_${emailId}_${now}`,
        'outreach_engine',
        'Outreach Agent',
        'email.sent',
        'outreach_email',
        emailId,
        1,
        JSON.stringify({ recipient: email.recipient_email, company: email.company, role: email.role }),
        now
      );

      db.prepare(`
        INSERT INTO events (id, type, timestamp, message, agent_id, task_id, mission_id, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        `ev_email_${emailId}_${now}`,
        'outreach.email_sent',
        now,
        `Sent application email to ${email.company} (${email.recipient_email}) for ${email.role}`,
        'outreach',
        null,
        null,
        JSON.stringify({ emailId, company: email.company, role: email.role })
      );

      return { success: true };
    } catch (err: any) {
      const errorMsg = err.message || String(err);
      db.prepare("UPDATE outreach_emails SET status = 'failed', error_message = ? WHERE id = ?").run(errorMsg, emailId);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Dispatches a batch of emails with staggered anti-spam rate limiting.
   */
  static async sendBatchStaggered(
    db: Database.Database,
    emailIds?: string[],
    customDelaySeconds?: number,
    onProgress?: (progress: { current: number; total: number; emailId: string; status: string }) => void
  ): Promise<{ sent: number; failed: number; results: Array<{ id: string; success: boolean; error?: string }> }> {
    const config = this.getConfig(db);
    const delayMs = Math.max(5, (customDelaySeconds || config.stagger_delay_seconds || 20)) * 1000;

    let targetIds: string[] = [];
    if (emailIds && emailIds.length > 0) {
      targetIds = emailIds;
    } else {
      const rows = db.prepare("SELECT id FROM outreach_emails WHERE status = 'staged' ORDER BY created_at ASC").all() as { id: string }[];
      targetIds = rows.map((r) => r.id);
    }

    const results: Array<{ id: string; success: boolean; error?: string }> = [];
    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < targetIds.length; i++) {
      const id = targetIds[i];
      if (onProgress) {
        onProgress({ current: i + 1, total: targetIds.length, emailId: id, status: 'sending' });
      }

      const res = await this.sendOutreachEmail(db, id);
      if (res.success) {
        sentCount++;
        results.push({ id, success: true });
      } else {
        failedCount++;
        results.push({ id, success: false, error: res.error });
      }

      // Stagger delay between subsequent emails (skip delay on the final email)
      if (i < targetIds.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return { sent: sentCount, failed: failedCount, results };
  }

  /**
   * Inspects workspace spreadsheets and drafts personalized application emails using Farhan's profile.
   */
  static async draftFromJobs(
    db: Database.Database,
    jobEntries?: Array<{ company: string; role: string; email?: string; notes?: string }>
  ): Promise<OutreachEmail[]> {
    const now = Date.now();
    const config = this.getConfig(db);

    // Retrieve Farhan's master profile
    let farhanName = config.sender_name || 'Md Farhan Hossain (Farhan)';
    let candidateEmail = config.gmail_address || 'farhan.sajid1896@gmail.com';
    let linkedin = 'https://www.linkedin.com/in/farhanfreak9137';
    let github = 'https://github.com/farhanfreak9137-ai';
    let portfolio = 'https://portfolio-two-chi-dgvbedq05m.vercel.app/';

    try {
      const profRow = db.prepare('SELECT data FROM professional_profile LIMIT 1').get() as { data: string } | undefined;
      if (profRow && profRow.data) {
        const parsed = JSON.parse(profRow.data);
        if (parsed.identity?.fullName) farhanName = parsed.identity.fullName;
        if (parsed.identity?.email) candidateEmail = parsed.identity.email;
        if (parsed.identity?.linkedInUrl) linkedin = parsed.identity.linkedInUrl;
        if (parsed.identity?.githubUrl) github = parsed.identity.githubUrl;
        if (parsed.identity?.portfolioUrl) portfolio = parsed.identity.portfolioUrl;
      }
    } catch {}

    // Default top curated jobs if none provided
    const defaultJobs = [
      {
        company: 'Synthesia',
        role: 'Senior AI Full-Stack Engineer',
        email: 'careers@synthesia.io',
        recipientName: 'Synthesia Engineering Team',
        matchDetails: 'Expertise in TypeScript, React, Node.js microservices, and practical streaming LLM pipelines.',
      },
      {
        company: 'Cursor (Anysphere)',
        role: 'Lead AI Developer Experience Engineer',
        email: 'talent@cursor.com',
        recipientName: 'Cursor Hiring Team',
        matchDetails: 'Building developer tools, TypeScript/React AI SDKs, and high-performance interactive interfaces.',
      },
      {
        company: 'Zapier',
        role: 'Software Engineer - AI Integrations',
        email: 'recruiting@zapier.com',
        recipientName: 'Zapier AI Integrations Team',
        matchDetails: 'Python, TypeScript, modern REST/WebSocket APIs, third-party LLM actions, and async workflows.',
      },
      {
        company: 'Vercel',
        role: 'Full Stack AI Engineer',
        email: 'talent@vercel.com',
        recipientName: 'Vercel Talent Acquisition',
        matchDetails: 'Next.js App Router, Edge runtime architecture, Vercel AI SDK integration, and full-stack TypeScript.',
      },
      {
        company: 'Weights & Biases',
        role: 'Staff Engineer - AI Applications',
        email: 'jobs@wandb.com',
        recipientName: 'W&B Hiring Team',
        matchDetails: 'Full-stack AI developer tooling, resilient distributed applications, and telemetry instrumentation.',
      },
    ];

    const jobsToDraft = jobEntries && jobEntries.length > 0 ? jobEntries : defaultJobs;
    const draftedEmails: OutreachEmail[] = [];

    const insertStmt = db.prepare(`
      INSERT INTO outreach_emails (
        id, company, role, recipient_email, recipient_name, subject, body_html, body_text, attachments, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'staged', ?)
    `);

    // Check workspace attachments
    const workspaceDir = path.resolve(process.cwd(), 'workspace');
    const attachmentFiles: string[] = [];
    if (fs.existsSync(path.join(workspaceDir, 'remote-job-matches.xlsx'))) {
      attachmentFiles.push('remote-job-matches.xlsx');
    }
    if (fs.existsSync(path.join(workspaceDir, 'remote-job-matches.md'))) {
      attachmentFiles.push('remote-job-matches.md');
    }

    for (const job of jobsToDraft) {
      const emailId = `out_${job.company.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 5)}`;
      const recipientName = (job as any).recipientName || `${job.company} Hiring Team`;
      const recipientEmail = job.email || `careers@${job.company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
      const subject = `Application: ${job.role} - ${farhanName}`;

      const bodyText = `Dear ${recipientName},

I am writing to express my strong interest in the ${job.role} opportunity at ${job.company}.

As a Full Stack & AI Integrations Engineer, I design and ship high-performance TypeScript/React web applications and autonomous AI agent architectures. Recently, I built and published Agent HQ (a comprehensive multi-agent operational platform featuring real-time event telemetry, persistent SQLite memory, and multi-model routing) as well as the HSC AI Study System.

Key alignment with ${job.company}:
• Production TypeScript, React, Next.js, and Node.js runtime microservices
• Autonomous LLM agent orchestration, streaming pipelines, and prompt engineering
• Disciplined execution, fast prototyping speed, and full-stack ownership

You can review my work and credentials here:
• Portfolio: ${portfolio}
• GitHub: ${github}
• LinkedIn: ${linkedin}

I have attached my relevant portfolio deliverables and research documentation for your review. I would welcome the opportunity to discuss how I can contribute to the ${job.company} team.

Best regards,

${farhanName}
Email: ${candidateEmail}
Location: Dhaka, Bangladesh (Flexible for 100% Remote overlap)
`;

      const bodyHtml = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; color: #1e293b; line-height: 1.6; font-size: 15px;">
  <p>Dear ${recipientName},</p>

  <p>I am writing to express my strong interest in the <strong>${job.role}</strong> position at <strong>${job.company}</strong>.</p>

  <p>As a Full Stack & AI Integrations Engineer, I design and ship high-performance TypeScript/React applications and autonomous AI agent platforms. Recently, I built and published <strong>Agent HQ</strong> (a multi-agent operational platform featuring real-time event telemetry, persistent SQLite memory, and multi-model routing) alongside real-world student-assist systems.</p>

  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #3b82f6; padding: 14px 18px; border-radius: 8px; margin: 18px 0;">
    <strong style="color: #0f172a;">Key Alignment with ${job.company}:</strong>
    <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #334155;">
      <li><strong>Full-Stack Mastery:</strong> Production TypeScript, React, Next.js, Node.js, and clean architecture.</li>
      <li><strong>AI Systems:</strong> Agent orchestration, streaming inference, context optimization, and resilient execution.</li>
      <li><strong>Fast Ownership:</strong> Proven track record of taking complex ideas from concept to live production software.</li>
    </ul>
  </div>

  <p>You can review my live work and background here:</p>
  <ul style="padding-left: 20px; margin: 10px 0;">
    <li><strong>Portfolio:</strong> <a href="${portfolio}" style="color: #2563eb; text-decoration: underline;">${portfolio}</a></li>
    <li><strong>GitHub:</strong> <a href="${github}" style="color: #2563eb; text-decoration: underline;">${github}</a></li>
    <li><strong>LinkedIn:</strong> <a href="${linkedin}" style="color: #2563eb; text-decoration: underline;">${linkedin}</a></li>
  </ul>

  <p>I have attached my documentation and portfolio deliverables. I look forward to the opportunity to speak with your team about how I can contribute to ${job.company}'s engineering initiatives.</p>

  <p style="margin-top: 24px;">
    Warm regards,<br/>
    <strong>${farhanName}</strong><br/>
    <span style="color: #64748b; font-size: 14px;">Email: ${candidateEmail} | Location: Dhaka, Bangladesh (100% Remote overlap)</span>
  </p>
</div>
`;

      const attachmentsJson = JSON.stringify(attachmentFiles);

      insertStmt.run(
        emailId,
        job.company,
        job.role,
        recipientEmail,
        recipientName,
        subject,
        bodyHtml,
        bodyText,
        attachmentsJson,
        now
      );

      draftedEmails.push({
        id: emailId,
        company: job.company,
        role: job.role,
        recipient_email: recipientEmail,
        recipient_name: recipientName,
        subject,
        body_html: bodyHtml,
        body_text: bodyText,
        attachments: attachmentsJson,
        status: 'staged',
        created_at: now,
      });
    }

    return draftedEmails;
  }
}
