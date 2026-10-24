/** Reject duplicate object members and excessive nesting before trusting JSON semantics. */
export function parseStrictJson(source: string): unknown {
  let position = 0;
  let nodes = 0;
  const whitespace = (): void => { while (/[\t\n\r ]/.test(source[position] ?? '\0')) position++; };
  const fail = (): never => { throw new Error('Invalid or ambiguous JSON'); };
  const string = (): string => {
    if (source[position] !== '"') return fail();
    const start = position++;
    while (position < source.length) {
      const next = source[position++];
      if (next === '\\') position++;
      else if (next === '"') return JSON.parse(source.slice(start, position)) as string;
    }
    return fail();
  };
  const value = (depth: number): unknown => {
    if (depth > 12 || ++nodes > 4096) return fail();
    whitespace();
    const next = source[position];
    if (next === '"') return string();
    if (next === '{') {
      position++;
      whitespace();
      const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
      if (source[position] === '}') { position++; return result; }
      while (position < source.length) {
        whitespace();
        const key = string();
        if (Object.hasOwn(result, key)) return fail();
        whitespace();
        if (source[position++] !== ':') return fail();
        result[key] = value(depth + 1);
        whitespace();
        const delimiter = source[position++];
        if (delimiter === '}') return result;
        if (delimiter !== ',') return fail();
      }
      return fail();
    }
    if (next === '[') {
      position++;
      whitespace();
      const result: unknown[] = [];
      if (source[position] === ']') { position++; return result; }
      while (position < source.length) {
        result.push(value(depth + 1));
        whitespace();
        const delimiter = source[position++];
        if (delimiter === ']') return result;
        if (delimiter !== ',') return fail();
      }
      return fail();
    }
    for (const [literal, parsed] of [['true', true], ['false', false], ['null', null]] as const) {
      if (source.startsWith(literal, position)) { position += literal.length; return parsed; }
    }
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(source.slice(position));
    if (!match) return fail();
    position += match[0].length;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : fail();
  };
  const result = value(0);
  whitespace();
  if (position !== source.length) return fail();
  return result;
}
