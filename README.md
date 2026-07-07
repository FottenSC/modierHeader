# CleanHeader

CleanHeader is an open-source Manifest V3 browser extension for Chrome and Edge that modifies HTTP request headers, response headers, and redirect URLs.

It is intentionally local-only:

- no ads
- no telemetry
- no affiliate or install/update/uninstall redirect pages
- no remote configuration
- no remote executable code

## Development

```sh
npm install
npm run prepare:wxt
npm run dev
```

## Verification

```sh
npm run verify
```

`verify` runs the source policy scanner, unit tests, TypeScript, Chrome and Edge WXT builds, manifest permission snapshot checks, and the production dependency audit.

## Release

```sh
npm run build
npm run zip
npm run build:edge
npm run zip:edge
npm run hash:release
```

Release archives and `SHA256SUMS` are generated in `.output/`. Publish the same local-only source to Chrome Web Store and Microsoft Edge Add-ons.

## License

MIT
