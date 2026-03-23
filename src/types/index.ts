export type UserRole = 'founder' | 'commissioner' | 'training_officer' | 'medical' | 'rover' | 'public';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  qualifications?: string[];
  phone?: string;
  dateJoined?: Date;
  avatar?: string;
}

export interface School {
  id: string;
  name: string;
  address: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  assignedTrainers: string[];
  activePrograms: string[];
  studentCount?: number;
}

export interface Event {
  id: string;
  title: string;
  type: 'training' | 'camp' | 'hike' | 'team_building' | 'leadership';
  date: Date;
  endDate?: Date;
  location: string;
  description: string;
  schools: string[];
  trainers: string[];
  maxParticipants?: number;
  currentParticipants?: number;
  status: 'planned' | 'ongoing' | 'completed' | 'cancelled';
}

export interface Program {
  id: string;
  name: string;
  description: string;
  duration: string;
  ageGroup: string;
  skills: string[];
  badge?: string;
}

export interface Booking {
  id: string;
  schoolId: string;
  eventType: string;
  preferredDates: Date[];
  message: string;
  status: 'pending' | 'confirmed' | 'rejected';
  createdAt: Date;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
}