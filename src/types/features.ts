export interface Feature {
  id: string;
  title: string;
  description: string;
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
