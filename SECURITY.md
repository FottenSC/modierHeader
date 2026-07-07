# Security Policy

## Supported Versions

Security fixes are provided for the latest released version.

## Reporting

Please report security issues privately to the maintainer before opening a public issue. Include reproduction steps, affected browser version, and whether host permissions were granted globally or per-site.

## Security Commitments

- modierHeaders does not download or execute remote code.
- modierHeaders stores configuration locally in browser extension storage.
- modierHeaders does not collect browsing history, credentials, page contents, or analytics.
- modierHeaders uses Manifest V3 `declarativeNetRequest` rules instead of request body interception.
- Release packages must be reproducible from tagged source.
