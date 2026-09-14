import fetch from 'node-fetch';

async function testNovelAnalysis() {
  const taskId = 'test_novel_' + Date.now();
  console.log(`Dispatching execution for task ${taskId}: "Analyze C:\\Novel"...`);

  const response = await fetch('http://127.0.0.1:3001/api/tasks/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taskId,
      agentId: 'atlas',
      agentName: 'ATLAS',
      role: 'Research Analyst',
      title: 'Analyze C:\\Novel and synthesize narrative architecture',
      description: 'Perform complete file and narrative audit of C:\\Novel',
      providerId: 'gemini',
    }),
  });

  const data = await response.json() as any;
  console.log('Status code:', response.status);
  console.log('Success:', data.success);
  console.log('Execution Mode:', data.executionMode);
  console.log('Summary:', data.summary);
  console.log('Output length:', data.output?.length || 0);
  console.log('\n--- First 1200 chars of actual output ---');
  console.log(data.output?.slice(0, 1200));
}

testNovelAnalysis().catch((err) => {
  console.error('Test error:', err);
});
