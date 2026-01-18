
export interface Lead {
  id: string;
  name: string;
  username: string;
  profileLink: string;
  followers: string;
  bio: string;
  location: string;
  hasWebsite: boolean;
  avatarUrl?: string;
  niche: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface MiningResult {
  leads: Lead[];
  sources: GroundingSource[];
}

export interface SearchConfig {
  niche: string;
  location: string;
  quantity: number;
  onlyWithoutWebsite: boolean;
}

export enum AppStatus {
  IDLE = 'IDLE',
  SEARCHING = 'SEARCHING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}
