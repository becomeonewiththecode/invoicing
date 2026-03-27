import type { Project } from '../api/projects';

/** Shape used for rendering project / invoice external links (label = description or URL). */
export type ExternalLinkItem = {
  url: string;
  description?: string | null;
  id?: string;
};

/**
 * Same ordering and legacy fallback as the Projects tab: `external_links` rows (sorted),
 * then legacy `external_link` when not duplicated.
 */
export function externalLinksFromProject(project: Project | undefined): ExternalLinkItem[] {
  if (!project) return [];
  if (project.external_links && project.external_links.length > 0) {
    return [...project.external_links]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((l) => ({
        id: l.id,
        url: l.url,
        description: l.description ?? null,
      }));
  }
  if (project.external_link?.trim()) {
    return [
      {
        url: project.external_link.trim(),
        description: project.external_link_description ?? null,
      },
    ];
  }
  return [];
}

/** Invoice API `project_external_links` — drop empty URLs. */
export function externalLinksFromInvoicePayload(
  links?: { url: string; description?: string | null }[] | null
): ExternalLinkItem[] {
  if (!links?.length) return [];
  return links.filter((l) => l.url?.trim());
}
