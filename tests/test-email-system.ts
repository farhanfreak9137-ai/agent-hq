import { EmailManager } from '../src/email/EmailManager.ts';
import { AGENT_DIRECTORY, COMMANDER_EMAIL } from '../src/email/EmailTypes.ts';

async function testEmailSystem() {
  console.log('=== Agent HQ Executive Email System Verification ===\n');

  // Verify Directory
  console.log('--- Agent Corporate Directory ---');
  for (const [id, info] of Object.entries(AGENT_DIRECTORY)) {
    console.log(`[Roster] ${info.symbol} ${info.name} (${info.role}) -> ${info.email}`);
  }

  // Check initial inbox
  const initialEmails = EmailManager.getAll();
  console.log(`\n[Inbox] Total emails on init: ${initialEmails.length}`);
  console.log(`[Inbox] Unread count: ${EmailManager.getUnreadCount()}`);

  // Test sending Mission Report from BOSS
  console.log('\n--- Testing Mission Report from BOSS ---');
  const missionMail = EmailManager.sendMissionReport(
    'Analyze the Agent HQ project',
    'Architectural audit concluded across all 9 modules. Identified modular boundaries, SQLite persistence layer, and Antigravity AI cascade.',
    [
      { name: 'Architecture Synthesis Report', type: 'document', content: 'Comprehensive system breakdown' },
      { name: 'Security Audit Certificate', type: 'security_report', content: 'Zero CVEs detected' },
    ],
    ['boss', 'nova', 'atlas', 'sentinel']
  );
  console.log(`[PASS] Mission email generated: "${missionMail.subject}"`);
  console.log(`[PASS] From: ${missionMail.fromAddress} -> To: ${missionMail.toAddress}`);

  // Test sending Direct Task Report from ATLAS
  console.log('\n--- Testing Direct Task Report from ATLAS ---');
  const taskMail = EmailManager.sendTaskReport(
    'atlas',
    'Analyze C:\\Novel this folder',
    'Completed deep text extraction and narrative structural analysis across files in C:\\Novel.',
    'Total word count: 84,200. Identified character arcs, chapters 1-12, thematic consistency index: 94%.',
    ['text_extractor', 'sentiment_analyzer']
  );
  console.log(`[PASS] Task email generated: "${taskMail.subject}"`);
  console.log(`[PASS] From: ${taskMail.fromAddress} -> To: ${taskMail.toAddress}`);

  // Verify Unread Count and Mark As Read
  console.log('\n--- Testing Read & Star Status ---');
  const unreadCount = EmailManager.getUnreadCount();
  console.log(`[PASS] Current unread count: ${unreadCount}`);
  if (unreadCount < 2) throw new Error('Expected at least 2 unread emails');

  EmailManager.markAsRead(taskMail.id);
  const newUnread = EmailManager.getUnreadCount();
  console.log(`[PASS] After marking task report read, unread count: ${newUnread}`);
  if (newUnread !== unreadCount - 1) throw new Error('Unread count did not decrement');

  console.log('\n=== All Email System Checks Passed Successfully! ===');
}

testEmailSystem().catch(console.error);
