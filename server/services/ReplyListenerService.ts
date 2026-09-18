import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import Database from 'better-sqlite3';
import { EmailService } from './EmailService.ts';
import { NotificationService } from './NotificationService.ts';

export interface IncomingReply {
  id: string;
  outreach_email_id?: string;
  from_email: string;
  from_name?: string;
  company: string;
  subject: string;
  body_text: string;
  body_html?: string;
  intent: 'interview_invite' | 'question' | 'rejection' | 'general';
  drafted_reply?: string;
  status: 'new' | 'staged' | 'replied' | 'archived';
  received_at: number;
  created_at: number;
}

export class ReplyListenerService {
  private static pollTimer: NodeJS.Timeout | null = null;
  private static isPolling: boolean = false;

  /**
   * Classifies email body and subject into recruiter intent.
   */
  static classifyIntent(subject: string = '', bodyText: string = ''): 'interview_invite' | 'question' | 'rejection' | 'general' {
    const text = ((subject || '') + ' ' + (bodyText || '')).toLowerCase();

    // 1. Check for interview invites
    const interviewTriggers = [
      'interview',
      'schedule a call',
      'schedule an interview',
      'schedule a conversation',
      'introductory call',
      'intro call',
      'schedule a',
      'time to chat',
      'chat this week',
      'availability for a call',
      'availability for an interview',
      'would love to connect',
      'like to connect',
      'like to speak',
      'screening call',
      'next round',
      'next steps in the process',
      'quick call',
      'phone screen',
      'zoom call',
      'google meet',
      'calendly.com',
      'cal.com',
    ];
    if (interviewTriggers.some((t) => text.includes(t))) {
      return 'interview_invite';
    }

    // 2. Check for rejections
    const rejectionTriggers = [
      'unfortunately',
      'not moving forward',
      'other candidates',
      'decided to pursue',
      'keep your resume on file',
      'future opportunities',
      'not selected',
      'wish you the best in your job search',
      'competitive applicant pool',
    ];
    if (rejectionTriggers.some((t) => text.includes(t))) {
      return 'rejection';
    }

    // 3. Check for technical inquiries / questions
    const questionTriggers = [
      'can you share',
      'could you share',
      'technical assessment',
      'coding challenge',
      'take-home',
      'sample of your work',
      'rate requirements',
      'what is your expected',
      'salary expectation',
      'notice period',
      'when can you start',
      'github link',
      'portfolio link',
    ];
    if (questionTriggers.some((t) => text.includes(t))) {
      return 'question';
    }

    return 'general';
  }

  /**
   * Generates a tailored follow-up draft using Farhan's profile.
   */
  static generateFollowUpDraft(
    db: Database.Database,
    reply: { from_name?: string; company: string; intent: string; subject: string; body_text: string }
  ): string {
    let farhanName = 'Md Farhan Hossain (Farhan)';
    let candidateEmail = 'farhan.sajid1896@gmail.com';
    let timezone = 'UTC+6 (Dhaka) / Flexible for US & European overlap';

    try {
      const profRow = db.prepare('SELECT data FROM professional_profile LIMIT 1').get() as { data: string } | undefined;
      if (profRow && profRow.data) {
        const parsed = JSON.parse(profRow.data);
        if (parsed.identity?.fullName) farhanName = parsed.identity.fullName;
        if (parsed.identity?.email) candidateEmail = parsed.identity.email;
        if (parsed.preferences?.timezoneRequirements) timezone = parsed.preferences.timezoneRequirements;
      }
    } catch {}

    const contactName = reply.from_name || 'Hiring Team';

    if (reply.intent === 'interview_invite') {
      return `Dear ${contactName},

Thank you very much for reaching out and for considering my application with ${reply.company}! I would be delighted to connect for a conversation.

Regarding availability:
My primary working timezone is ${timezone}. I can readily accommodate video calls via Google Meet, Zoom, or your team's preferred platform:
• Wednesday or Thursday: 2:00 PM – 7:00 PM UTC (9:00 AM – 2:00 PM US Eastern)
• Friday: 1:00 PM – 6:00 PM UTC (8:00 AM – 1:00 PM US Eastern)

If any of those windows work for you, please let me know or feel free to share a calendar invite link and I will book a time immediately.

Looking forward to speaking with you!

Best regards,

${farhanName}
Email: ${candidateEmail}`;
    }

    if (reply.intent === 'question') {
      return `Dear ${contactName},

Thank you for following up on my application.

I am pleased to provide the requested details:
• Live Portfolio: https://portfolio-two-chi-dgvbedq05m.vercel.app/
• GitHub Profile: https://github.com/farhanfreak9137-ai
• Working Hours: ${timezone}

Please let me know if you need any additional code samples, architectural documentation, or references.

Best regards,

${farhanName}
Email: ${candidateEmail}`;
    }

    if (reply.intent === 'rejection') {
      return `Dear ${contactName},

Thank you for taking the time to update me regarding the position at ${reply.company}.

I truly appreciate your team's consideration. I remain very enthusiastic about ${reply.company}'s work in the space and would welcome staying in touch for any future opportunities that align with my background.

Wishing you and the team continued success.

Warm regards,

${farhanName}`;
    }

    return `Dear ${contactName},

Thank you for your message regarding the opportunity at ${reply.company}.

I would be happy to discuss this further at your convenience.

Best regards,

${farhanName}
Email: ${candidateEmail}`;
  }

  /**
   * Connects to Gmail IMAP and scans for recent incoming messages from companies we contacted.
   */
  static async pollInbox(db: Database.Database): Promise<{
    checked: boolean;
    newReplies: number;
    replies: IncomingReply[];
    error?: string;
  }> {
    if (this.isPolling) {
      return { checked: false, newReplies: 0, replies: [], error: 'Poll already in progress' };
    }

    const config = EmailService.getConfig(db);
    if (!config.gmail_address || !config.app_password) {
      return { checked: false, newReplies: 0, replies: [], error: 'Gmail credentials not configured' };
    }

    this.isPolling = true;
    const client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: {
        user: config.gmail_address,
        pass: config.app_password.replace(/\s+/g, ''),
      },
      logger: false,
    });

    const newRepliesList: IncomingReply[] = [];

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');

      try {
        // Query sent outreach companies to cross-reference
        const sentOutreach = db.prepare('SELECT id, company, role, recipient_email FROM outreach_emails').all() as Array<{
          id: string;
          company: string;
          role: string;
          recipient_email: string;
        }>;

        // Search for recent incoming emails from last 7 days
        const sinceDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const searchCriteria = { since: sinceDate };

        // Fetch messages
        for await (const message of client.fetch(searchCriteria, { source: true, uid: true, envelope: true })) {
          if (!message.source) continue;

          const parsed = await simpleParser(message.source);
          const fromAddress = parsed.from?.value[0]?.address?.toLowerCase() || '';
          const fromName = parsed.from?.value[0]?.name || parsed.from?.text || '';
          const subject = parsed.subject || '(No Subject)';
          const textBody = parsed.text || '';
          const htmlBody = typeof parsed.html === 'string' ? parsed.html : '';
          const messageId = parsed.messageId || `reply_${message.uid}_${Date.now()}`;

          // Avoid processing emails sent by Farhan himself
          if (fromAddress === config.gmail_address.toLowerCase()) {
            continue;
          }

          // Check if already stored in database
          const existing = db.prepare('SELECT id FROM incoming_replies WHERE id = ?').get(messageId);
          if (existing) {
            continue;
          }

          // Match against sent outreach emails
          let matchedOutreach = sentOutreach.find(
            (o) =>
              fromAddress.includes(o.recipient_email.toLowerCase()) ||
              o.recipient_email.toLowerCase().includes(fromAddress) ||
              (o.company && subject.toLowerCase().includes(o.company.toLowerCase()))
          );

          let detectedCompany = matchedOutreach ? matchedOutreach.company : '';
          if (!detectedCompany) {
            // Extract domain company if looks like business domain
            const domain = fromAddress.split('@')[1];
            if (domain && !['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'].includes(domain)) {
              detectedCompany = domain.split('.')[0];
              detectedCompany = detectedCompany.charAt(0).toUpperCase() + detectedCompany.slice(1);
            }
          }

          if (detectedCompany) {
            const intent = this.classifyIntent(subject, textBody);
            const draftedReply = this.generateFollowUpDraft(db, {
              from_name: fromName,
              company: detectedCompany,
              intent,
              subject,
              body_text: textBody,
            });

            const now = Date.now();
            const replyRecord: IncomingReply = {
              id: messageId,
              outreach_email_id: matchedOutreach ? matchedOutreach.id : undefined,
              from_email: fromAddress,
              from_name: fromName,
              company: detectedCompany,
              subject,
              body_text: textBody,
              body_html: htmlBody,
              intent,
              drafted_reply: draftedReply,
              status: 'new',
              received_at: parsed.date ? parsed.date.getTime() : now,
              created_at: now,
            };

            db.prepare(`
              INSERT INTO incoming_replies (
                id, outreach_email_id, from_email, from_name, company, subject, body_text, body_html, intent, drafted_reply, status, received_at, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              replyRecord.id,
              replyRecord.outreach_email_id || null,
              replyRecord.from_email,
              replyRecord.from_name || null,
              replyRecord.company,
              replyRecord.subject,
              replyRecord.body_text,
              replyRecord.body_html || null,
              replyRecord.intent,
              replyRecord.drafted_reply || null,
              replyRecord.status,
              replyRecord.received_at,
              replyRecord.created_at
            );

            newRepliesList.push(replyRecord);

            // Trigger Discord Phone Notification
            await NotificationService.sendAlert(db, {
              title: `${detectedCompany} Replied: "${subject}"`,
              message: textBody.substring(0, 350) + (textBody.length > 350 ? '...' : ''),
              company: detectedCompany,
              role: matchedOutreach ? matchedOutreach.role : undefined,
              intent,
              fromEmail: fromAddress,
            });
          }
        }
      } finally {
        lock.release();
      }

      await client.logout();
      return { checked: true, newReplies: newRepliesList.length, replies: newRepliesList };
    } catch (err: any) {
      try {
        await client.logout();
      } catch {}
      return { checked: false, newReplies: 0, replies: [], error: err.message || String(err) };
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Starts periodic background inbox polling.
   */
  static startBackgroundListener(db: Database.Database, intervalMinutes: number = 5) {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }

    const intervalMs = Math.max(2, intervalMinutes) * 60 * 1000;
    this.pollTimer = setInterval(async () => {
      try {
        await this.pollInbox(db);
      } catch (err) {
        console.warn('[ReplyListenerService] Background poll error:', err);
      }
    }, intervalMs);
  }

  /**
   * Stops periodic background inbox polling.
   */
  static stopBackgroundListener() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}
