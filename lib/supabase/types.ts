export type PrayerName = 'Fajr' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha'
export type PrayerStatus = 'pending' | 'on_time' | 'late' | 'missed'
export type TaskPriority = 'high' | 'medium' | 'low'
export type TaskCategory = 'Work' | 'TA' | 'PhD' | 'Admin' | 'Personal'
export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type LearningDomain = 'PhD Research' | 'Programming/Tech' | 'Soft Skills' | 'Productivity'
export type LearningPlanMode = 'manual' | 'ai' | 'hybrid'
export type LearningGoalStatus = 'active' | 'paused' | 'completed'
export type LearningSessionStatus = 'pending' | 'done' | 'skipped' | 'rescheduled'
export type CoachingType = 'morning_checkin' | 'evening_reflection' | 'cbt_tip' | 'coaching_message' | 'wellbeing_pulse'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  location_lat: number | null
  location_lng: number | null
  city: string | null
  city_name: string | null
  prayer_method: string
  prayer_notification_offset: number
  notification_offset_minutes: number
  dark_mode: boolean
  work_start_hour: number
  work_hours: number
  work_hours_per_day: number
  xp: number
  level: number
  daily_streak: number
  streak_days: number
  prayer_streak: number
  work_streak: number
  learning_streak: number
  created_at: string
  updated_at: string
}

export interface Prayer {
  id: string
  user_id: string
  date: string
  name: PrayerName
  scheduled_time: string
  status: PrayerStatus
  completed_at: string | null
  xp_earned: number
  created_at: string
}

export interface Task {
  id: string
  user_id: string
  title: string
  description: string | null
  due_date: string | null
  scheduled_date: string | null
  priority: TaskPriority
  category: TaskCategory
  status: TaskStatus
  is_recurring: boolean
  recurrence_rule: string | null
  estimated_minutes: number | null
  actual_minutes: number | null
  is_deep_work: boolean
  xp_earned: number
  completed_at: string | null
  monthly_plan_id: string | null
  created_at: string
  updated_at: string
}

export interface MonthlyPlan {
  id: string
  user_id: string
  title: string
  month: string // YYYY-MM
  start_date: string
  end_date: string
  goal_text: string | null
  overview: string | null
  ai_plan: {
    overview: string
    weeks: Array<{
      week_number: number
      theme: string
      focus: string
      milestone: string
    }>
  } | null
  hours_per_day: number
  category: string
  created_at: string
}

export interface PomodoroSession {
  id: string
  user_id: string
  task_id: string | null
  started_at: string
  ended_at: string | null
  duration_minutes: number
  completed: boolean
  created_at: string
}

export interface LearningGoal {
  id: string
  user_id: string
  title: string
  domain: LearningDomain
  target_date: string | null
  estimated_hours: number | null
  total_hours_done: number
  status: LearningGoalStatus
  plan_mode: LearningPlanMode
  ai_plan: AIPlan | null
  topics: string[] | null
  created_at: string
  updated_at: string
}

export interface AIPlan {
  sessions: AISession[]
  overview: string
  estimated_weeks: number
}

export interface AISession {
  week: number
  day: string
  title: string
  duration_minutes: number
  description: string
  resources: Resource[]
}

export interface Resource {
  type: 'article' | 'video' | 'book' | 'paper'
  title: string
  url?: string
}

export interface LearningSession {
  id: string
  user_id: string
  goal_id: string
  title: string
  scheduled_date: string | null
  duration_minutes: number
  status: LearningSessionStatus
  resources: Resource[] | null
  notes: string | null
  xp_earned: number
  completed_at: string | null
  created_at: string
}

export interface FamilyEvent {
  id: string
  user_id: string
  title: string
  description: string | null
  event_date: string | null
  start_time: string | null
  end_time: string | null
  is_recurring: boolean
  recurrence_rule: string | null
  status: 'planned' | 'completed' | 'missed'
  xp_earned: number
  quick_log_note: string | null
  created_at: string
}

export interface DailyScore {
  id: string
  user_id: string
  date: string
  prayer_score: number
  work_score: number
  learning_score: number
  family_score: number
  total_score: number
  mood_score: number | null
  xp_earned: number
  mood: number | null
  energy: number | null
  evening_reflection: string | null
  gratitude: string | null
  created_at: string
}

export interface Badge {
  id: string
  user_id: string
  badge_id: string
  badge_key: string
  badge_name: string
  badge_description: string | null
  badge_icon: string | null
  earned_at: string
}

export interface CoachingLog {
  id: string
  user_id: string
  type: CoachingType
  content: Record<string, unknown>
  ai_response: string | null
  created_at: string
}

export interface WellbeingPulse {
  id: string
  user_id: string
  date: string
  q1_energy: number | null
  q2_focus: number | null
  q3_relations: number | null
  q4_purpose: number | null
  q5_overall: number | null
  average: number | null
  mood: number | null
  energy: number | null
  clarity: number | null
  stress: number | null
  connection: number | null
  wellbeing_score: number | null
  created_at: string
}

export interface PrayerTimes {
  Fajr: string
  Dhuhr: string
  Asr: string
  Maghrib: string
  Isha: string
  Sunrise: string
  Sunset: string
}

export interface TimelineBlock {
  id: string
  type: 'prayer' | 'work' | 'learning' | 'family' | 'buffer' | 'task'
  title: string
  startTime: string
  endTime: string
  color: string
  isProtected: boolean
  status?: string
  entityId?: string
}

// ============================================================
// WEEKLY PLANNING SYSTEM
// ============================================================

export interface Category {
  id: string
  user_id: string
  name: string
  color: string
  icon: string
  is_default: boolean
  created_at: string
}

export type DailyItemStatus = 'pending' | 'done' | 'skipped'
export type WeeklyItemPriority = 'high' | 'medium' | 'low'

export interface WeekPlan {
  id: string
  user_id: string
  week_start: string
  title: string | null
  created_at: string
}

export interface WeeklyItem {
  id: string
  user_id: string
  week_plan_id: string
  category_id: string
  title: string
  description: string | null
  target_days: number
  priority: WeeklyItemPriority
  link: string | null
  created_at: string
  categories?: Category
}

export interface DailyItem {
  id: string
  user_id: string
  week_plan_id: string | null
  weekly_item_id: string | null
  category_id: string
  title: string
  scheduled_date: string
  status: DailyItemStatus
  xp_earned: number
  completed_at: string | null
  link: string | null
  is_bonus: boolean
  actual_minutes: number
  created_at: string
  categories?: Category
}

export interface XpLog {
  id: string
  user_id: string
  source_type: string
  source_id: string | null
  xp_amount: number
  earned_at: string
}
