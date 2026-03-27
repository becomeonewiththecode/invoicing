import api from './client';

export interface ProjectMilestone {
  title: string;
  due_date?: string | null;
}

export interface ProjectAttachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size_bytes: string;
  mime_type: string | null;
  created_at: string;
}

export interface ProjectExternalLink {
  id: string;
  url: string;
  description?: string | null;
  sort_order?: number;
  created_at?: string;
}

export interface Project {
  id: string;
  client_id: string;
  user_id?: string;
  name: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status: string;
  priority: string;
  /** @deprecated Prefer `external_links`; may remain on older rows until migrated */
  external_link?: string | null;
  external_link_description?: string | null;
  external_links?: ProjectExternalLink[];
  budget?: string | null;
  hours?: string | null;
  hours_is_maximum?: boolean;
  dependencies?: string | null;
  milestones: ProjectMilestone[] | unknown;
  team_members: string[] | null;
  tags: string[] | null;
  notes?: string | null;
  attachments?: ProjectAttachment[];
  created_at?: string;
  updated_at?: string;
}

export interface ProjectPayload {
  name: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string;
  priority?: string;
  externalLinks?: { url: string; description?: string | null }[];
  budget?: number | null;
  hours?: number | null;
  hoursIsMaximum?: boolean;
  dependencies?: string | null;
  milestones?: { title: string; dueDate?: string | null }[];
  teamMembers?: string[];
  tags?: string[];
  notes?: string | null;
  attachmentUrls?: string[];
}

export async function getClientProjects(clientId: string): Promise<Project[]> {
  const { data } = await api.get<Project[]>(`/clients/${clientId}/projects`);
  return data;
}

export async function createClientProject(clientId: string, payload: ProjectPayload): Promise<Project> {
  const { data } = await api.post<Project>(`/clients/${clientId}/projects`, payload);
  return data;
}

export async function updateClientProject(
  clientId: string,
  projectId: string,
  payload: Partial<ProjectPayload>
): Promise<Project> {
  const { data } = await api.put<Project>(`/clients/${clientId}/projects/${projectId}`, payload);
  return data;
}

export async function deleteClientProject(clientId: string, projectId: string): Promise<void> {
  await api.delete(`/clients/${clientId}/projects/${projectId}`);
}
