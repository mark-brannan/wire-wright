# Security Policy

## Supported versions

This package is alpha and maintained as a single moving line. Only the latest
version published to npm gets fixes; there are no maintenance branches, and a
pre-1.0 release may change behaviour in a patch.

| Version | Supported |
| ------- | --------- |
| latest `0.0.x-alpha` on [npm](https://www.npmjs.com/package/wire-wright) | yes |
| anything older | no — upgrade first |

If that is too loose for you, pin an exact version and read the release notes
before moving. It will tighten at 1.0.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.** Report it
privately through GitHub:

1. Go to
   [Security → Report a vulnerability](https://github.com/mark-brannan/wire-wright/security/advisories/new).
2. Describe what you found, which version you saw it in, and how to reproduce
   it. A CSV that triggers it is worth more than a description.

You should get an acknowledgement within a week. This is a spare-time project
maintained by one person, so a fix may take longer than that — you will be told
where it stands rather than left waiting. If a report is valid and you want
credit, you will be named in the advisory.

If you get no response at all within two weeks, open a public issue saying only
that you are waiting on a private report — no details — and it will be picked
up.

## What is in scope

- **The CSV reader.** A circuit list is untrusted input — it may come from a
  spreadsheet, a surveyor, or a boatyard. A file that crashes the CLI, hangs
  it, or causes it to read or write a path it should not is in scope.
- **The CLI's handling of its arguments and its output path.**
- **The published tarball** — anything shipped in `files` that should not be
  there, or a discrepancy between npm and this repository at the corresponding
  tag.
- **The dependency edge.** This package depends on
  [ampacity](https://github.com/mark-brannan/ampacity) for its tables. A way to
  make it load data from somewhere else is in scope here.

## What is out of scope

- **The correctness of a sizing result.** An under-sized conductor is the most
  serious thing this tool can get wrong, and it is an ordinary bug: open a
  public issue with the circuit that produced it.
- The values in the ABYC tables themselves. Those live in
  [ampacity](https://github.com/mark-brannan/ampacity/issues); a transcription
  error is filed there.
- ABYC E-11 itself, and whether its guidance suits your installation. This tool
  is informational and is not a substitute for a qualified marine electrician
  or your surveyor.
- The things the README's *Limits* section says this does not do — summing
  loads, panel totals, fuse interrupt ratings. Those are known gaps, and an
  issue asking for one is a feature request, not a vulnerability.

## Notes on how this package is built

- **One dependency, and it is data.** `ampacity` ships JSON and no code, so
  nothing in this package's dependency tree executes at install or at run time
  other than this package itself.
- `npm ci` and `npm test` run with the network unavailable.
