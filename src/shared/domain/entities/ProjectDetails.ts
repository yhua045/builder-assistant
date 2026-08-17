import { Contact } from './Contact.ts';
import { Project } from './Project.ts';
import { Property } from './Property.ts';

export interface ProjectDetails extends Project {
  // hydrated references
  owner: Contact;
  property?: Property;
  upcomingTasks: Array<{ title: string; dueDate: string }>;
}
