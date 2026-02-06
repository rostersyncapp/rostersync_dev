
export type SubscriptionTier = 'BASIC' | 'PRO' | 'STUDIO' | 'NETWORK';

export type NILStatus = 'Active' | 'Transfer' | 'Alumni' | 'Incoming';

export interface Project {
  id: string;
  userId: string;
  name: string;
  parentId?: string; // Support for sub-folders
  description?: string;
  createdAt: string;
  color?: string;
}

export interface Athlete {
  id: string;
  originalName: string;
  fullName: string;
  displayNameSafe: string; // ALL CAPS, no accents
  jerseyNumber: string; // Used as Bib Number in NOC mode
  position: string; // Used as Discipline/Event in NOC mode
  phoneticIPA: string;
  phoneticSimplified: string;
  nilStatus: NILStatus;
  seasonYear: string;
  nameSpanish?: string;
  nameMandarin?: string;
  bioStats?: string;
  socialHandle?: string;
  countryCode?: string; // IOC Country Code (e.g., USA, FRA)
  organisationId?: string; // FK -> Nations.id (IOC Code)
  firstName?: string;
  lastName?: string;
  gender?: 'M' | 'W';
  birthDate?: string;
  heightCm?: number;
  weightKg?: number;
  placeOfBirth?: string;
  event?: string; // Specific Olympic Event
  sportCode?: string; // 3-letter ODF Discipline Code (e.g. ALP, IHO)
  dbStatus?: 'MATCHED' | 'NOT_FOUND'; // For UI flagging in ODF mode
  metadata?: Record<string, any>;
}

export interface TeamMetadata {
  primaryColor: string;
  secondaryColor: string;
  conference: string;
  abbreviation: string;
  logoUrl?: string;
  countryCode?: string; // IOC Country Code for NOC mode
}

export interface Roster {
  id: string;
  userId: string;
  projectId?: string;
  teamName: string;
  sport: string;
  league?: string; // League identifier (nba, ipl, nfl, etc.)
  seasonYear: string;
  athleteCount: number;
  rosterData: Athlete[];
  versionDescription: string;
  createdAt: string;
  teamMetadata?: TeamMetadata;
  isSynced?: boolean;
  isNocMode?: boolean;
  preferredAccentColor?: string; // User selected accent color
}

export interface Profile {
  id: string;
  fullName?: string;
  email?: string;
  subscriptionTier: SubscriptionTier;
  organizationName: string;
  orgLogoUrl?: string; // Workspace custom logo URL
  creditsUsed: number;
}

export type ExportFormat = 'CSV_FLAT' | 'ICONIK_JSON' | 'CATDV_JSON' | 'ROSS_XML' | 'VIZRT_JSON' | 'VIZRT_DATACENTER_CSV' | 'VIZRT_XML' | 'CHYRON_CSV' | 'NEWBLUE_CSV' | 'TAGBOARD_CSV' | 'ODF_XML';
