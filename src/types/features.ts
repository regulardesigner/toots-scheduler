export interface Feature {
  id: string;
  title: string;
  description: string;
  elementId: string;
}

export interface FeatureGroup {
  version: string;
  date: string;
  features: Feature[];
}

export interface UserFeatureState {
  lastSeenVersion: string;
  seenFeatures: string[];
}

export const APP_VERSION = '1.0.0'; 