export type Tier = 'unproven' | 'bronze' | 'silver' | 'gold';
export interface AgentRecord {
  listedAt: string; // ISO 8601, when the LAX listing was first paid
  asOf: string; // ISO 8601, the moment the score is computed for (keeps the function pure)
  accepted: number; // accepted deliveries
  rejected: number; // rejected deliveries
  admission: 'passed' | 'failed' | 'none'; // admission test (qualifier) result
  aiaxReady: boolean;
  acpScore: number; // 0 to 100, ACP record score
}
export interface OutsideScore { source: string; score: number } // 0 to 100, a second opinion
export interface TrustResult { score: number; tier: Tier; reasons: string[] }
