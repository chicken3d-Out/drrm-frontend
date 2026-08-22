export interface TrackPoint {
  lon: number;
  lat: number;
  date: string;
}

export interface DisasterEvent {
  id: string;
  disaster_type: string;
  official_title: string;
  source_agency: string;
  warning_level: string | null;
  description: string | null;
  status: string;
  issued_at: string;
  last_updated_at: string;
  official_source_url: string | null;
  is_leyte_priority: boolean;
  latitude: number | null;
  longitude: number | null;
  track: TrackPoint[] | null;
}

export interface AffectedSchool {
  id: string;
  name: string;
  municipality: string;
  district: string | null;
  priority: 'high' | 'potential';
  distance_km: number;
  coordinator_name: string | null;
  coordinator_phone: string | null;
}

export interface School {
  id: string;
  school_id: string;
  name: string;
  school_type: string;
  district: string | null;
  municipality: string;
  barangay: string | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
}

export interface SchoolContact {
  contact_type: string;
  name: string | null;
  phone: string | null;
  email: string | null;
}

export interface SchoolDetail extends School {
  contacts: SchoolContact[];
}

export interface PendingUser {
  id: string;
  email: string;
  status: string;
  created_at: string;
  full_name: string | null;
  designation: string | null;
  office: string | null;
  roles: string[] | null;
}

export interface DataSourceHealth {
  id: string;
  name: string;
  adapter_type: string;
  status: 'online' | 'degraded' | 'offline';
  last_sync_at: string | null;
  last_events_retrieved: number | null;
  last_error: string | null;
  last_response_time_ms: number | null;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: string;
  attachment_url: string | null;
  published_at: string;
  expires_at: string | null;
  author_name: string | null;
  author_email: string;
}

export interface AppNotification {
  id: string;
  disaster_event_id: string | null;
  title: string;
  body: string;
  priority: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' | 'INFORMATION';
  type: 'official_alert' | 'app_proximity' | 'school_alert' | 'announcement' | 'chat';
  read: boolean;
  created_at: string;
}

export interface NotificationPreferences {
  earthquake: boolean;
  tsunami: boolean;
  volcano: boolean;
  rainfall: boolean;
  tropical_cyclone: boolean;
  thunderstorm: boolean;
  other_hazards: boolean;
  leyte_alerts: boolean;
  nearby_alerts: boolean;
  school_alerts: boolean;
  critical_alerts: boolean;
}

export interface ChatMessage {
  id: string;
  content: string;
  created_at: string;
  reported: boolean;
  sender_id: string;
  sender_email: string;
  sender_name: string | null;
  profile_picture_url: string | null;
}

export const AVAILABLE_ROLES = [
  'DRRM_ADMIN',
  'DIVISION_DRRM_STAFF',
  'SCHOOL_DRRM_COORDINATOR',
  'SCHOOL_HEAD',
  'DEPED_PERSONNEL',
  'SYSTEM_ADMIN'
] as const;
