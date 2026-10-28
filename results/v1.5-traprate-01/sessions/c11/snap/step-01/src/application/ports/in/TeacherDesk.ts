export interface TeacherView {
  readonly id: string;
  readonly name: string;
  readonly instruments: string[];
  readonly calendarId: string;
}

export interface TeachingHoursView {
  readonly teacher: string;
  readonly date: string;
  readonly windows: string[];
}

export interface TeacherDesk {
  addTeacher(name: string, instruments: string[], calendarId: string): TeacherView;
  teacher(id: string): TeacherView;
  teachingHours(teacherId: string, date: string): TeachingHoursView;
}
