import { csvField, toCsv } from './csv';

describe('csv', () => {
  it('quotes only fields that need it', () => {
    expect(csvField('plain')).toBe('plain');
    expect(csvField('a, b')).toBe('"a, b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField(3)).toBe('3');
  });

  it('joins rows with CRLF and a trailing newline', () => {
    expect(
      toCsv([
        ['a', 1],
        ['b,c', 2],
      ]),
    ).toBe('a,1\r\n"b,c",2\r\n');
  });
});
