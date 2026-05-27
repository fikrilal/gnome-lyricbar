import { describe, expect, it } from 'vitest';

import { readStringProperty } from '../../scripts/lib/gdbus-output.mjs';

describe('readStringProperty', () => {
  it('reads single-quoted GVariant strings', () => {
    const raw = "({'Metadata': <{'xesam:title': <'Radioactive'>}>},)";

    expect(readStringProperty(raw, 'xesam:title')).toBe('Radioactive');
  });

  it('reads double-quoted GVariant strings containing apostrophes', () => {
    const raw = "({'Metadata': <{'xesam:title': <\"I'll Be Missing You\">}>},)";

    expect(readStringProperty(raw, 'xesam:title')).toBe("I'll Be Missing You");
  });

  it('decodes escaped double-quoted string content', () => {
    const raw = '({\'Metadata\': <{\'xesam:title\': <"A \\"Quoted\\" Title">}>},)';

    expect(readStringProperty(raw, 'xesam:title')).toBe('A "Quoted" Title');
  });

  it('returns null when the key is absent', () => {
    const raw = "({'Metadata': <{'xesam:artist': <['Imagine Dragons']>}>},)";

    expect(readStringProperty(raw, 'xesam:title')).toBeNull();
  });
});
