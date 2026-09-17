import {
  OpportunitySourceAdapter,
  RawOpportunity,
  NormalizedOpportunity,
} from './OpportunitySourceAdapter.ts';
import { OpportunityType } from '../../types/index.ts';

/**
 * =========================================================================
 * REAL PUBLIC SOURCE ADAPTER: ARBEITNOW JOB BOARD API
 * =========================================================================
 *
 * Source Name: Arbeitnow Public Job Board
 * Public URL: https://www.arbeitnow.com/api/job-board-api
 * Access Method: Public HTTP GET returning JSON (no authentication, no CAPTCHA, no cookies)
 * Rate Limits: Generous developer API; capped to single-page retrieval (up to 20 items) per run
 * Relevant Usage Restrictions: Free for non-commercial & developer integrations; preserves canonical source URLs
 * Fields Available: slug, company_name, title, description, remote, url, tags, job_types, location, created_at
 * Verification Approach: STRICTLY UNVERIFIED. All discovered items enter as UNVERIFIED.
 *   Discovery does not equal verification. Verification requires explicit human review.
 */
export class ArbeitnowOpportunityAdapter implements OpportunitySourceAdapter {
  public readonly sourceId = 'arbeitnow_public_api';
  public readonly sourceName = 'Arbeitnow Public Tech & Internships';

  private readonly apiUrl: string;

  constructor(apiUrl: string = 'https://www.arbeitnow.com/api/job-board-api') {
    this.apiUrl = apiUrl;
  }

  public async discover(): Promise<RawOpportunity[]> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(this.apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AgentHQ-DiscoveryEngine/1.0 (Student Career Intelligence Engine)',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        console.warn(`[ArbeitnowAdapter] HTTP ${response.status}: ${response.statusText}`);
        return [];
      }

      const json = await response.json();
      if (!json || !Array.isArray(json.data)) {
        return [];
      }

      // Filter and map technical, software engineering, AI, or student/intern friendly items
      const rawOpportunities: RawOpportunity[] = [];

      for (const item of json.data) {
        if (!item.title || !item.company_name || !item.url) continue;

        const titleLower = item.title.toLowerCase();
        const descLower = (item.description || '').toLowerCase();
        const tagsLower = Array.isArray(item.tags) ? item.tags.map((t: string) => t.toLowerCase()) : [];
        const isInternOrJunior =
          titleLower.includes('intern') ||
          titleLower.includes('junior') ||
          titleLower.includes('student') ||
          titleLower.includes('associate') ||
          titleLower.includes('apprentice') ||
          (Array.isArray(item.job_types) && item.job_types.some((jt: string) => jt.toLowerCase().includes('intern')));

        const isTechOrAI =
          titleLower.includes('software') ||
          titleLower.includes('developer') ||
          titleLower.includes('engineer') ||
          titleLower.includes('frontend') ||
          titleLower.includes('react') ||
          /\b(ai|llm|ml|data)\b/i.test(titleLower) ||
          descLower.includes('typescript') ||
          descLower.includes('react') ||
          tagsLower.some((t: string) => t.includes('engineering') || t.includes('tech') || t.includes('it'));

        // We focus on student, junior, software, and AI opportunities
        if (isInternOrJunior || isTechOrAI) {
          rawOpportunities.push({
            externalId: item.slug || item.url,
            title: item.title,
            organization: item.company_name,
            rawType: isInternOrJunior ? 'internship' : 'job',
            url: item.url,
            applyUrl: item.url,
            location: item.location || 'Unknown',
            remote: Boolean(item.remote),
            description: item.description ? item.description.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim().slice(0, 1500) : '',
            requirements: tagsLower.slice(0, 8),
            eligibility: item.location ? [`Location eligibility: ${item.location}`] : [],
            deadline: undefined, // Arbeitnow uses rolling admissions
            discoveredAt: Date.now(),
            tags: item.tags || [],
            rawPayload: { slug: item.slug },
          });
        }
      }

      // Limit to 15 most relevant opportunities per manual run to respect rate limits
      return rawOpportunities.slice(0, 15);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[ArbeitnowAdapter] Failed to fetch opportunities: ${msg}`);
      return [];
    }
  }

  public normalize(raw: RawOpportunity): NormalizedOpportunity {
    let type: OpportunityType = 'job';
    if (raw.rawType === 'internship' || raw.title.toLowerCase().includes('intern')) {
      type = 'internship';
    }

    // Extract potential requirements from tags and descriptions using precise word-boundary matching
    const detectedReqs: string[] = [];
    if (raw.requirements && raw.requirements.length > 0) {
      detectedReqs.push(...raw.requirements);
    }
    const desc = raw.description || '';
    const keywords = ['TypeScript', 'JavaScript', 'React', 'Next.js', 'Python', 'Node.js', 'Docker', 'SQLite', 'PostgreSQL', 'Git', 'Tailwind', 'AI', 'LLM'];
    for (const kw of keywords) {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wordRegex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (wordRegex.test(desc) && !detectedReqs.some((r) => r.toLowerCase() === kw.toLowerCase())) {
        detectedReqs.push(kw);
      }
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
      remote: Boolean(raw.remote),
      description: raw.description || '',
      requirements: detectedReqs.slice(0, 10),
      eligibility: raw.eligibility && raw.eligibility.length > 0 ? raw.eligibility : ['General applicant eligibility'],
      deadline: raw.deadline,
      discoveredAt: raw.discoveredAt || Date.now(),
      // STRICT REQUIREMENT: Newly discovered opportunities are ALWAYS UNVERIFIED
      sourceVerification: 'UNVERIFIED',
      status: 'DISCOVERED',
      evidence: [`Discovered via ${this.sourceName} (${raw.url})`],
    };
  }
}
