import Database from 'better-sqlite3';
import { NotificationService, AlertPayload } from '../server/services/NotificationService.ts';
import { ReplyListenerService } from '../server/services/ReplyListenerService.ts';

async function runTests() {
  console.log('=== Agent HQ: Discord Notifications & Email Reply Listener Verification ===\n');

  // 1. In-memory DB setup
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS notification_settings (
      id TEXT PRIMARY KEY,
      channel TEXT DEFAULT 'discord',
      discord_webhook_url TEXT DEFAULT '',
      is_enabled INTEGER DEFAULT 1,
      poll_interval_minutes INTEGER DEFAULT 5,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS incoming_replies (
      id TEXT PRIMARY KEY,
      outreach_email_id TEXT,
      sender_name TEXT,
      sender_email TEXT NOT NULL,
      recipient_email TEXT NOT NULL,
      company TEXT NOT NULL,
      role TEXT,
      subject TEXT NOT NULL,
      body_snippet TEXT NOT NULL,
      full_body TEXT NOT NULL,
      received_at INTEGER NOT NULL,
      intent TEXT NOT NULL,
      suggested_reply TEXT,
      status TEXT DEFAULT 'new',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS farhan_profile (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      title TEXT NOT NULL,
      location TEXT,
      timezone TEXT,
      salary_expectation TEXT,
      years_of_experience INTEGER,
      availability TEXT,
      portfolio_url TEXT,
      github_url TEXT,
      linkedin_url TEXT,
      primary_tech_stack TEXT,
      skills_csv TEXT,
      bio TEXT,
      cover_letter_template TEXT,
      preferred_roles TEXT,
      updated_at INTEGER NOT NULL
    );
  `);

  // Seed farhan_profile
  db.prepare(`
    INSERT INTO farhan_profile (
      id, full_name, email, title, location, timezone, availability, portfolio_url, github_url, linkedin_url, primary_tech_stack, skills_csv, bio, updated_at
    ) VALUES (
      'farhan_master', 'Farhan Freelance', 'farhan@example.com', 'Senior Full Stack Engineer', 'Dhaka / Remote', 'GMT+6', 'Available immediately (within 24 hours notice)', 'https://farhan.dev', 'https://github.com/farhanfreak', 'https://linkedin.com/in/farhan', 'TypeScript, Node.js, React, Python', 'React, Node, TypeScript, Tailwind, GraphQL', 'Full-stack builder with 5+ years experience building scalable web apps.', ?
    )
  `).run(Date.now());

  console.log('--- 1. Testing NotificationService Configuration ---');
  const initialConfig = NotificationService.getConfig(db);
  console.log(`[PASS] Initial channel: ${initialConfig.channel}, is_enabled: ${initialConfig.is_enabled}`);
  if (initialConfig.channel !== 'discord') throw new Error('Expected default channel to be discord');

  const updatedConfig = NotificationService.updateConfig(db, {
    discord_webhook_url: 'https://discord.com/api/webhooks/123456/dummy-token',
    is_enabled: 1,
    poll_interval_minutes: 3
  });
  console.log(`[PASS] Updated Webhook URL: ${updatedConfig.discord_webhook_url}`);
  console.log(`[PASS] Updated Interval: ${updatedConfig.poll_interval_minutes}m`);
  if (updatedConfig.poll_interval_minutes !== 3) throw new Error('Failed to update poll interval');

  console.log('\n--- 2. Testing Discord Webhook Payload Validation ---');
  // Test with invalid URL
  const invalidResult = await NotificationService.sendDiscordWebhook('not-a-valid-url', {
    title: 'Test',
    message: 'Test Message'
  });
  console.log(`[PASS] Invalid URL rejected gracefully: "${invalidResult.error}"`);
  if (invalidResult.success !== false) throw new Error('Should reject invalid webhook URL');

  console.log('\n--- 3. Testing Recruiter Intent Classification ---');
  const testCases = [
    {
      text: 'Thanks for reaching out! We were very impressed by your profile and would love to schedule a 30-minute introductory call this Thursday or Friday.',
      expectedIntent: 'interview_invite'
    },
    {
      text: 'Could you share some examples of projects where you used TypeScript and GraphQL? Also, what are your salary expectations?',
      expectedIntent: 'question'
    },
    {
      text: 'Unfortunately, we have decided to move forward with other candidates whose experience more closely matches our requirements at this time.',
      expectedIntent: 'rejection'
    },
    {
      text: 'We received your application and will get back to you if there is a match.',
      expectedIntent: 'general'
    }
  ];

  for (const tc of testCases) {
    const classified = (ReplyListenerService as any).classifyIntent(tc.text);
    console.log(`[PASS] Body snippet -> classified as "${classified}" (Expected: "${tc.expectedIntent}")`);
    if (classified !== tc.expectedIntent) {
      throw new Error(`Expected intent ${tc.expectedIntent} but got ${classified}`);
    }
  }

  console.log('\n--- 4. Testing AI Follow-Up Draft Generation ---');
  const inviteDraft = ReplyListenerService.generateFollowUpDraft(
    db,
    {
      from_name: 'Sarah Recruiter',
      company: 'Stripe',
      intent: 'interview_invite',
      subject: 'Interview with Stripe',
      body_text: 'We would love to interview you for the Senior Frontend Engineer role.'
    }
  );
  console.log('[PASS] Generated Interview Invite Draft:');
  console.log('--- Draft Content ---');
  console.log(inviteDraft);
  console.log('---------------------');
  if (!inviteDraft.includes('Farhan') || !inviteDraft.includes('UTC+6')) {
    throw new Error('Draft should incorporate Farhan\'s name and timezone');
  }

  const questionDraft = ReplyListenerService.generateFollowUpDraft(
    db,
    {
      from_name: 'Alex Tech Lead',
      company: 'Vercel',
      intent: 'question',
      subject: 'Questions regarding your application',
      body_text: 'Could you share your portfolio link and availability?'
    }
  );
  console.log('\n[PASS] Generated Question Answer Draft:');
  console.log('--- Draft Content ---');
  console.log(questionDraft);
  console.log('---------------------');
  if (!questionDraft.includes('Portfolio') && !questionDraft.includes('GitHub')) {
    throw new Error('Draft should incorporate Farhan\'s links');
  }

  console.log('\n=== All Discord and Email Reply Tests Passed Successfully! ===');
}

runTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
