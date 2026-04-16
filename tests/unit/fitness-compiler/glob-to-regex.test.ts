import { globToRegex } from '../../../src/fitness-compiler/glob-to-regex.js';

describe('globToRegex', () => {
  it('matches literal path exactly', () => {
    const regex = globToRegex('src/domain/User.ts');
    expect('src/domain/User.ts').toMatch(new RegExp(regex));
    expect('src/domain/Other.ts').not.toMatch(new RegExp(regex));
  });

  it('converts * to single-level wildcard', () => {
    const regex = globToRegex('src/*.ts');
    expect('src/index.ts').toMatch(new RegExp(regex));
    expect('src/deep/index.ts').not.toMatch(new RegExp(regex));
  });

  it('converts ** to recursive wildcard', () => {
    const regex = globToRegex('src/**');
    expect('src/a.ts').toMatch(new RegExp(regex));
    expect('src/deep/nested/file.ts').toMatch(new RegExp(regex));
  });

  it('handles **/*.spec.ts pattern', () => {
    const regex = globToRegex('**/*.spec.ts');
    expect('src/user.spec.ts').toMatch(new RegExp(regex));
    expect('tests/deep/thing.spec.ts').toMatch(new RegExp(regex));
    expect('src/user.ts').not.toMatch(new RegExp(regex));
  });

  it('converts ? to single character', () => {
    const regex = globToRegex('file?.ts');
    expect('file1.ts').toMatch(new RegExp(regex));
    expect('fileAB.ts').not.toMatch(new RegExp(regex));
  });

  it('escapes dots in literal filenames', () => {
    const regex = globToRegex('package.json');
    expect('package.json').toMatch(new RegExp(regex));
    expect('packageXjson').not.toMatch(new RegExp(regex));
  });

  it('handles src/cli/** pattern', () => {
    const regex = globToRegex('src/cli/**');
    expect('src/cli/commands.ts').toMatch(new RegExp(regex));
    expect('src/cli/sub/deep.ts').toMatch(new RegExp(regex));
    expect('src/domain/entity.ts').not.toMatch(new RegExp(regex));
  });

  it('anchors pattern for full path matching', () => {
    const regex = globToRegex('src/domain/**');
    expect('prefix/src/domain/file.ts').not.toMatch(new RegExp(regex));
  });

  it('throws on empty pattern', () => {
    expect(() => globToRegex('')).toThrow('Empty glob pattern');
  });

  it('handles path with special regex characters', () => {
    const regex = globToRegex('src/[utils]/file.ts');
    expect('src/[utils]/file.ts').toMatch(new RegExp(regex));
  });
});
