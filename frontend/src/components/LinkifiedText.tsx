import { Fragment } from 'react';

const URL_RE = /https?:\/\/[^\s<>"']+/gi;

function LinkifiedLine({ line }: { line: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(URL_RE.source, URL_RE.flags);
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) {
      parts.push(<span key={`t-${last}`}>{line.slice(last, m.index)}</span>);
    }
    const url = m[0];
    parts.push(
      <a
        key={`u-${m.index}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline break-all"
      >
        {url}
      </a>
    );
    last = m.index + url.length;
  }
  if (last < line.length) {
    parts.push(<span key={`e-${last}`}>{line.slice(last)}</span>);
  }
  return <>{parts}</>;
}

type Props = {
  text: string;
  /** e.g. notes: preserve newlines */
  preserveLineBreaks?: boolean;
  className?: string;
};

/**
 * Renders plain text with `http(s)://…` segments turned into anchors that open in a new tab.
 */
export function LinkifiedText({ text, preserveLineBreaks = false, className }: Props) {
  if (!preserveLineBreaks) {
    return (
      <span className={className}>
        <LinkifiedLine line={text} />
      </span>
    );
  }
  const lines = text.split('\n');
  return (
    <span className={className}>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 ? '\n' : null}
          <LinkifiedLine line={line} />
        </Fragment>
      ))}
    </span>
  );
}
