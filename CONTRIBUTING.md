# Contributing

Thanks for looking. wire-wright sizes DC circuits on small craft against ABYC
E-11: it reads a CSV circuit list, prints a sizing table, and flags circuits
whose inputs are still guesses.

**This is alpha software whose output people wire boats with.** Both halves of
that matter. The interface can still change; a wrong number cannot.

## The two things worth reporting most

- **A sizing result you believe is wrong.** Bring the circuit — the CSV row, or
  the numbers in it — and what you expected instead. That is reproducible, and
  a test case falls straight out of it.
- **A limit that bit you.** The *Limits* section of the README is honest about
  what this does not do: it does not sum loads, check panel totals, or verify
  fuse interrupt ratings. If you hit one of those and it was not obvious you
  were about to, say so. Making a limit visible is as valuable as lifting it.

## Where the numbers come from

The tables are not in this repository. They live in
[ampacity](https://github.com/mark-brannan/ampacity), a data-only package that
exists so that ports in other languages share one source of truth and one
fixture set.

**So a transcription error is filed against ampacity, not here.** A
*calculation* error — the right table read the wrong way — is this repository's.
If you are unsure which you have found, file it here and it will be moved.

## Setting up

```shell
git clone https://github.com/mark-brannan/wire-wright.git
cd wire-wright
npm ci
npm test
```

Node 20 or newer. The only dependency is `ampacity`, which is data.

To run it against your own circuits:

```shell
node bin/cli.mjs circuits.csv
```

## Before you open a pull request

```shell
npm test
```

Then:

- **A change to sizing arrives with a test**, and the test asserts numbers — a
  conductor size, a fuse rating, a drop percentage — never the shape of the
  printed table. `test/calc.test.mjs` checks this implementation against ABYC's
  own 3% and 10% conductor-size lookup tables; a change that moves a result has
  to say which published case it now matches.
- **Sizing is conservative where the standard is ambiguous.** If a reading of
  E-11 would produce a *smaller* conductor or a *larger* fuse than the current
  code does, that is not a tidy-up. Argue it in the pull request before writing
  it.
- **New CSV columns need a default that is safe when omitted.** Every optional
  column already has one, and the defaults lean toward the more demanding
  answer. Keep that.
- **Branch from latest `main`**, and rebase onto it rather than merging it in.
- **One logical change per pull request.**
- **Commits are conventional**: `<type>(<scope>): <subject>`, imperative,
  50 characters or fewer.

## Versions

Pre-1.0 and alpha, so the interface is allowed to move — but the *output* is
what people act on, so:

- **A change to any sizing result is called out in the pull request**, whatever
  the version number does. Someone has a table printed and taped inside a
  locker.
- A new column, a new flag, or a new output field is a minor.
- Breaking the CSV contract or the CLI is a major once this reaches 1.0. Before
  then, say so loudly and it will be handled in the release notes.

## Code of Conduct

Participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).

## Licence

Contributions are licensed under the [MIT licence](LICENSE) that covers this
project.
