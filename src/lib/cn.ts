/** Minimal class joiner — keeps JSX readable without pulling in a dependency. */
export const cn = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');
