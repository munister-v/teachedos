export interface JournalEntry {
  id: string;
  user_id: string;
  title: string;
  date: string;
  group_name?: string;
  level?: string;
  topic?: string;
  notes?: string;
  homework?: string;
  created_at: string;
}

export interface VocabItem {
  id: string;
  user_id: string;
  word: string;
  translation?: string;
  example?: string;
  tags?: string;
  learned?: boolean;
}

export interface Attendance {
  id: string;
  journal_id: string;
  student_name: string;
  status: 'present' | 'absent' | 'late';
}
