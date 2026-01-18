
export interface Lead {
  id: string;
  name: string;
  username?: string; // Instagram username
  profileLink?: string; // Instagram link
  hasInstagram: boolean;
  hasWebsite: boolean;
  websiteUrl?: string;
  phone?: string;
  location: string;
  bio: string;
  niche: string;
  isFavorite?: boolean;
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

export type TabType = 'EXPLORE' | 'FAVORITES';
