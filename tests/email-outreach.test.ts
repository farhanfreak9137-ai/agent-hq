import { getDatabase } from '../server/db/database.ts';
import { seedDatabase } from '../server/db/migrations.ts';
import { EmailService } from '../server/services/EmailService.ts';

async function runEmailOutreachTests() {
  console.log('====================================================');
  console.log('GMAIL INTEGRATION & OUTREACH OUTBOX TEST SUITE');
  console.log('====================================================\n');

  const db = getDatabase();
  seedDatabase(db);

  // Test 1: Config Retrieval & Defaults
  console.log('--- Test 1: Email Configuration & Database Persistence ---');
  const config = EmailService.getConfig(db);
  if (!config || !config.gmail_address) {
    throw new Error('Failed to retrieve default email configuration');
  }
  console.log(`[PASS] Config verified: User="${config.gmail_address}", Sender="${config.sender_name}", Stagger="${config.stagger_delay_seconds}s"`);

  // Test 2: Config Updates & Whitespace Stripping
  console.log('\n--- Test 2: App Password Formatting & Update ---');
  const updated = EmailService.updateConfig(db, {
    app_password: 'abcd efgh ijkl mnop',
    sender_name: 'Md Farhan Hossain (Farhan)',
    stagger_delay_seconds: 25,
  });
  if (updated.app_password !== 'abcdefghijklmnop') {
    throw new Error(`Expected whitespace to be stripped from app password, got: "${updated.app_password}"`);
  }
  console.log('[PASS] App password whitespace stripped correctly and persisted to SQLite.');

  // Test 3: Auto-Drafting Applications from Remote Jobs Sheet
  console.log('\n--- Test 3: Automated Job Application Drafting ---');
  // Clear any existing test drafts
  db.prepare('DELETE FROM outreach_emails').run();

  const drafted = await EmailService.draftFromJobs(db);
  if (drafted.length < 5) {
    throw new Error(`Expected at least 5 drafted emails, got ${drafted.length}`);
  }

  console.log(`[PASS] Drafted ${drafted.length} customized job applications:`);
  for (const email of drafted) {
    console.log(` - ${email.company} (${email.role}) -> ${email.recipient_email}`);
    if (!email.subject.includes(email.role)) {
      throw new Error(`Subject does not contain role: ${email.subject}`);
    }
    if (!email.body_text.includes('Agent HQ') || !email.body_text.includes('GitHub')) {
      throw new Error(`Body does not contain key Farhan credentials: ${email.body_text.substring(0, 100)}`);
    }
  }

  // Test 4: Verify Database Staging Status & Attachments
  console.log('\n--- Test 4: SQLite Database Staging Verification ---');
  const stagedRows = db.prepare("SELECT * FROM outreach_emails WHERE status = 'staged'").all() as any[];
  if (stagedRows.length !== drafted.length) {
    throw new Error(`Mismatch in staged database rows: expected ${drafted.length}, found ${stagedRows.length}`);
  }

  for (const row of stagedRows) {
    const attachments = JSON.parse(row.attachments || '[]');
    if (!attachments.includes('remote-job-matches.xlsx')) {
      throw new Error(`Attachments do not include remote-job-matches.xlsx for ${row.company}`);
    }
  }
  console.log(`[PASS] All ${stagedRows.length} applications verified in SQLite with status='staged' and workbook attachments.`);

  // Test 5: Attachment File Resolver
  console.log('\n--- Test 5: Attachment Path Resolver ---');
  const resolved = EmailService.resolveAttachments(stagedRows[0].attachments);
  if (resolved.length === 0) {
    throw new Error('Failed to resolve attachment files from workspace/');
  }
  console.log(`[PASS] Successfully resolved ${resolved.length} physical attachment files for email:`);
  for (const att of resolved) {
    console.log(`   - ${att.filename} (${att.path})`);
  }

  console.log('\n====================================================');
  console.log('ALL GMAIL & OUTREACH OUTBOX TESTS PASSED 100%!');
  console.log('====================================================\n');
}

runEmailOutreachTests().catch((err) => {
  console.error('[TEST SUITE FAILED]:', err);
  process.exit(1);
});
