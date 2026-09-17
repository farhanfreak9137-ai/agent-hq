import {
  OpportunitySourceAdapter,
  RawOpportunity,
  NormalizedOpportunity,
} from '../OpportunitySourceAdapter.ts';
import { OpportunityType } from '../../../types/index.ts';

/**
 * MockOpportunitySourceAdapter provides deterministic mock data strictly
 * for testing and test harnesses.
 *
 * NOTE: This adapter is strictly for test infrastructure and must never
 * populate production data or be presented as a real source.
 */
export class MockOpportunitySourceAdapter implements OpportunitySourceAdapter {
  public readonly sourceId = 'mock_test_adapter';
  public readonly sourceName = 'Mock Test Opportunity Source';

  private mockItems: RawOpportunity[];

  constructor(customItems?: RawOpportunity[]) {
    this.mockItems = customItems || [
      {
        externalId: 'mock-raw-1',
        title: 'Junior Software Engineer Intern (TypeScript & React)',
        organization: 'OpenSource Labs Network',
        rawType: 'internship',
        url: 'https://mock.opensource.org/internships/ts-react-2026',
        applyUrl: 'https://mock.opensource.org/apply/ts-react-2026',
        location: 'Remote',
        remote: true,
        description: 'Collaborate on open-source TypeScript tooling and React frontend applications.',
        requirements: ['TypeScript', 'React', 'Git'],
        eligibility: ['Enrolled student or self-taught developer', 'Global applicants welcome'],
        deadline: '2026-11-30',
        tags: ['react', 'typescript', 'frontend'],
      },
      {
        externalId: 'mock-raw-2',
        title: 'AI Systems Apprentice',
        organization: 'Synthetic Intelligence Initiative',
        rawType: 'internship',
        url: 'https://mock.syntheticai.org/careers/apprentice-2026',
        location: 'Remote',
        remote: true,
        description: 'Assist in building autonomous multi-agent pipelines and benchmark reasoning workflows.',
        requirements: ['Python', 'Multi-Agent Systems', 'Node.js'],
        eligibility: ['Passionate about artificial intelligence and agent architectures'],
        deadline: '2026-12-15',
        tags: ['ai', 'multi-agent', 'python'],
      },
    ];
  }

  public async discover(): Promise<RawOpportunity[]> {
    // Return a clone to prevent external mutation
    return this.mockItems.map((item) => ({ ...item }));
  }

  public normalize(raw: RawOpportunity): NormalizedOpportunity {
    let type: OpportunityType = 'internship';
    if (raw.rawType === 'job' || raw.rawType === 'hackathon' || raw.rawType === 'competition' || raw.rawType === 'freelance' || raw.rawType === 'open_source') {
      type = raw.rawType;
    }

    return {
      title: (raw.title || 'Untitled Opportunity').trim(),
      organization: (raw.organization || 'Unknown Organization').trim(),
      type,
      source: this.sourceName,
      sourceId: this.sourceId,
      sourceName: this.sourceName,
      sourceUrl: raw.url || 'UNKNOWN',
      applicationUrl: raw.applyUrl || raw.url,
      location: raw.location || 'Remote',
      remote: raw.remote !== undefined ? raw.remote : true,
      description: raw.description || '',
      requirements: raw.requirements ? [...raw.requirements] : [],
      eligibility: raw.eligibility ? [...raw.eligibility] : [],
      deadline: raw.deadline,
      discoveredAt: raw.discoveredAt || Date.now(),
      // STRICT REQUIREMENT: All newly discovered opportunities begin as UNVERIFIED
      sourceVerification: 'UNVERIFIED',
      status: 'DISCOVERED',
      evidence: [`Discovered from ${this.sourceName}`],
    };
  }
}
