export interface ScheduleEntry {
  id: string;
  user_id: string;
  title: string;
  day: number;
  start_time: string;
  end_time: string;
  color: string;
  group_name?: string;
  level?: string;
  room?: string;
  notes?: string;
  meeting_url?: string;
  is_live?: boolean;
  recurring?: boolean;
}
