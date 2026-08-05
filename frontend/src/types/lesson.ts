export const LESSON_SUBJECTS = [
  "Coding",
  "Robotics",
  "Art",
  "Kiro"
] as const;

export type LessonSubject = (typeof LESSON_SUBJECTS)[number];

export const LESSON_BLOCK_TYPES = [
  "intro",
  "concept",
  "activity",
  "quiz",
  "wrap-up"
] as const;

export type LessonBlockType = (typeof LESSON_BLOCK_TYPES)[number];

export interface LessonResource {
  url: string;
  label?: string;
}

export interface Lesson {
  _id: string;
  lessonCode?: string;
  title: string;
  description?: string;
  subject: LessonSubject;
  courseCode?: string;
  courseName?: string;
  lessonNumber?: number;
  duration?: number;
  objectives?: string[];
  prerequisites?: string[];
  materials?: string[];
  tags?: string[];
  createdBy?: string | null;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LessonContent {
  _id: string;
  lessonId: string;
  lessonTitle?: string;
  blockType: LessonBlockType;
  blockIndex: number;
  title?: string;
  content?: string;
  resources?: LessonResource[];
  estimatedMinutes?: number;
  createdBy?: string | null;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LessonWithBlocks extends Lesson {
  blocks?: LessonContent[];
}

export interface LessonFilter {
  subject?: LessonSubject | "";
  courseCode?: string;
  q?: string;
}

export type LessonMode = "add" | "edit";
export type ContentMode = "add" | "edit";
