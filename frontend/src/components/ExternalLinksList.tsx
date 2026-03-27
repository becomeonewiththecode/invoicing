import type { ExternalLinkItem } from '../utils/externalLinksDisplay';

type Props = {
  links: ExternalLinkItem[];
  /** Applied to the `<ul>` — default matches project cards on the client Projects tab */
  className?: string;
};

/**
 * Renders project/invoice document links with human-readable labels (`description` or URL), same markup as
 * `ClientProjectsTab` project cards.
 */
export function ExternalLinksList({ links, className = 'text-sm mt-2 space-y-1 list-none pl-0' }: Props) {
  if (!links.length) return null;
  return (
    <ul className={className}>
      {links.map((l, i) => (
        <li key={l.id ?? `link-${i}-${l.url}`}>
          <a
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
            title={l.description?.trim() ? l.url : undefined}
          >
            {l.description?.trim() || l.url}
          </a>
        </li>
      ))}
    </ul>
  );
}
