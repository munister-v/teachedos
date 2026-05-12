export interface Board {
  id: string;
  user_id: string;
  name: string;
  theme?: string;
  cards?: Card[];
  created_at: string;
  updated_at?: string;
}

export interface Card {
  id: string;
  type: string;
  title: string;
  content?: string;
  order: number;
  column?: string;
  meta?: Record<string, unknown>;
}

export interface Comment {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar: string;
  text: string;
  created_at: string;
}
