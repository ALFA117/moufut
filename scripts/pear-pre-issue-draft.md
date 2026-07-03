# `pear run --dev .` fails with `ERR_INVALID_CONFIG: pear.pre ... did not respond with configuration data in time` — hook subprocess never sends data over the IPC pipe on Windows

## Environment

- OS: Windows 11 Home, build 10.0.26200
- `pear` (npm global): `2.0.4`
- Node: v22.17.0
- Reproduced with both `type: "desktop"` (original app) and `type: "terminal"` (minimal repro below)
- Reproduced both through the npm-installed `pear` shim **and** by invoking the native binary directly (`%APPDATA%\pear\current\by-arch\win32-x64\bin\pear-runtime.exe run --dev .`), bypassing the shim entirely — same failure, so this isn't a PATH/shim issue.
- `pear run pear://runtime` (the "Fix automatically" command suggested by the `pear --version` PATH warning) was run to completion — no change in behavior.

## Steps to reproduce (minimal, no third-party packages)

A completely trivial `pear.pre` hook fails identically — no `@qvac/sdk` or any
other dependency involved. `package.json`:

```json
{
  "name": "pear-pre-repro",
  "version": "1.0.0",
  "main": "index.js",
  "type": "module",
  "pear": {
    "name": "pearpretest",
    "type": "terminal",
    "pre": ["./pre.js"]
  }
}
```

`pre.js` (implements the same `pear-pipe`/`compact-encoding` protocol as any
`pear.pre` hook, but does nothing else — responds to the first message as
fast as possible):

```js
import * as cenc from 'compact-encoding'
import pearPipe from 'pear-pipe'

console.error('[repro] pre.js started')

const pipe = pearPipe()
if (!pipe) {
  console.error('[repro] No IPC pipe available')
  process.exit(1)
}
pipe.autoexit = true

pipe.once('error', (err) => {
  console.error('[repro] pipe error', err)
})

pipe.once('data', (data) => {
  console.error('[repro] got data from host, responding immediately')
  try {
    const options = cenc.decode(cenc.any, data)
    pipe.end(cenc.encode(cenc.any, { tag: 'configure', data: options }))
  } catch (err) {
    console.error('[repro] decode/encode failed', err)
    pipe.destroy(err)
  }
})
```

`index.js`:

```js
console.log('hello from pear-pre-repro')
```

Run `pear run --dev .` in that directory.

(The original report below used `@qvac/sdk@0.14.0`'s bundled `pear-pre` hook
instead — see "Why I don't think this is specific to `@qvac/sdk`'s hook" for
how that was ruled out before building this minimal repro.)

## Expected

The `pre` hook runs, responds with configuration data over its IPC pipe, and the app boots normally.

## Actual

```
DEPRECATED: pear run is deprecated and will be removed
Use the pear-runtime module instead
x ERR_INVALID_CONFIG: pear.pre "file:///.../pear-pre-repro/pre.js" did not respond with configuration data in time
    at file:///.../boot.bundle/pre.js:128:11
    at Scheduler._ontimeout (bare:/bare.js:2671:17)
```

Note that **none of the `console.error` lines from `pre.js` are printed** —
not even the very first `'[repro] pre.js started'` at the top of the file,
before any pipe/IPC logic runs. Either the subprocess's stdout/stderr
forwarding is broken in this failure mode, or the script never starts
executing at all.

The failure is consistently timed at **~5.0-5.9s** across both this minimal
repro and the original `@qvac/sdk`-based report below (measured with `time`),
which lines up exactly with the `IDLE_TIMEOUT = 5000` constant I found in the
installed runtime bundle (`%APPDATA%\pear\by-dkey\<dkey>\1\boot.bundle`):

```js
#run(options, link, index, from) {
  const { cwd } = this
  const sp = spawn(RUNTIME, ['run', '--base', this.dir, '--prerunning', '--trusted', link], {
    stdio: ['ignore', 'pipe', 'pipe', 'overlapped'],
    windowsHide: true,
    cwd
  })
  const IDLE_TIMEOUT = 5000
  const SELF_CLOSE_WAIT = 2500
  ...
  const promise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ...
      reject(new ERR_INVALID_CONFIG('pear.pre "' + link + '" did not respond with configuration data in time'))
    }, IDLE_TIMEOUT).unref()
    const ondata = (data) => { ... }
    pipe.on('data', ondata)
    ...
  })
}
```

The 4th stdio slot (`'overlapped'` — a Windows named-pipe transport) never receives any data from the spawned `pre` subprocess within the 5s window, regardless of what the hook script itself does.

## Why this isn't specific to `@qvac/sdk`'s hook

Before building the minimal repro above, I first hit this with
`@qvac/sdk@0.14.0`'s bundled `pear.pre` hook (`@qvac/sdk/dist/pear/pre.js`) in
a real app, and ruled out that hook's own logic as the cause:

1. That hook requires a `worker.js` file at the app root (via
   `DEFAULT_PEAR_WORKER`); my project didn't have one, which would make its
   `configure()` throw synchronously and early. I added a `worker.js` and
   reran — the error was byte-for-byte identical, at the same ~5s timing.
2. No stdout/stderr from that hook's subprocess was visible either — same
   symptom confirmed again, more cleanly, by the minimal repro above.

The minimal repro removes `@qvac/sdk` from the equation entirely and fails
the exact same way, which confirms this is a platform-level issue: the
`stdio: [..., 'overlapped']` IPC transport used for `--prerunning` on Windows
never delivers data in either direction (host → hook or hook → host), for
any `pear.pre` hook, regardless of what that hook's code does.

## What I haven't done yet (worth doing before treating this as fully closed)

- Haven't tested on Linux/macOS to confirm this is Windows-specific (the `'overlapped'` stdio type is itself a Windows-only libuv/Node concept, which is why I suspect it, but I haven't run a side-by-side comparison).
- Haven't bisected across `pear` versions to see if this is a regression or has always been broken on Windows for `pear.pre` hooks.
- Haven't confirmed whether stdout/stderr forwarding from `--prerunning` subprocesses is expected to work at all on Windows in this `pear` version — if it's known-broken independently of the IPC pipe, that would at least explain why `'[repro] pre.js started'` never surfaced even if the script did start.

## Impact

Blocks `pear run --dev .` (and presumably `pear stage`) for **any** package that declares a `pear.pre` hook and runs on Windows — not limited to `@qvac/sdk`.
