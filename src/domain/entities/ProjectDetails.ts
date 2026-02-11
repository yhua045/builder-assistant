import { Contact } from './Contact';
import { Project } from './Project';
import { Property } from './Property';

export interface ProjectDetails extends Project {
  // hydrated references
  owner: Contact;
  property?: Property;
}
