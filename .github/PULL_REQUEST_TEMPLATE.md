## What and why

<!--
Motivation and approach, not mechanics — the diff shows what changed. If this
closes an issue, say so here: closes #12
-->

## Does this move a sizing result?

<!--
REQUIRED. People have this tool's output taped inside a locker. If any conductor
size, fuse rating or flag changes, say which and by how much — even if the
version number stays a patch.

If a result gets SMALLER (a thinner conductor, a larger fuse), that is not a
tidy-up: name the reading of E-11 that justifies it. See CONTRIBUTING.md.

Write "no" if nothing about the output changes.
-->

## Version

- [ ] patch
- [ ] minor (new column, new flag, new output field)
- [ ] major / breaking (CSV contract or CLI — describe the break above)

## Checks

- [ ] `npm test` passes
- [ ] New or changed sizing is covered by a test that asserts numbers, not printed layout
- [ ] Any new CSV column has a default that is safe when omitted
- [ ] The README's CSV table and *Limits* section still match the code
- [ ] Branched from latest `main` (rebased, not merged)
- [ ] One logical change

## Tests

<!--
Which published ABYC case the new test matches — the table, and the row. A
sizing change that cannot name one needs an argument instead.
-->

## Anything the maintainer should look at

<!--
An ambiguity in E-11 you had to resolve, or a limit this brushes against.
Delete if there is nothing.
-->
