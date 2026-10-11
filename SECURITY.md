# Security Policy

## Supported Versions

PulseProbe receives active security patches on the latest main branch.

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1.0 | :x:                |

## Reporting a Vulnerability

We take the security of PulseProbe and the infrastructure it interacts with seriously. If you discover a security vulnerability (such as an SSRF bypass, denial of service vector, authentication bypass, or data exposure), please report it responsibly:

1. **Do NOT open a public issue or discussion** on GitHub.
2. Please report the vulnerability privately via **GitHub Security Advisories** on the repository:
   - Navigate to **Security** > **Advisories** > **Report a vulnerability**.
   - Alternatively, email the maintainer directly at: `amostheuri.dev@gmail.com` with the subject `[SECURITY] PulseProbe Vulnerability Report`.
3. Provide detailed steps to reproduce the issue, including:
   - Target payload or HTTP request
   - Affected file, endpoint, or component
   - Proof-of-concept (PoC) code or screenshots
   - Potential impact of exploitation

## Response Timeline

- **Initial Acknowledgement**: Within 48 hours of receipt.
- **Triage & Assessment**: Within 5 business days.
- **Fix & Public Advisory**: Coordinated release with reporter attribution (unless anonymity requested).

## Security Safeguards in PulseProbe

PulseProbe incorporates several built-in defensive layers:
- **SSRF Protection Engine**: Pre-flight DNS resolution and subnet filtering blocking loopback, link-local, RFC 1918, and cloud metadata endpoints (`169.254.169.254`).
- **Redirect Validation**: HTTP redirects are intercepted and strictly re-validated against the SSRF engine before following.
- **DNS Rebinding Defense**: Connect-time socket address verification.
- **Rate Limiting**: Sliding window rate limits on mutating and status endpoints.
- **Authentication**: Bearer token authentication via `PULSEPROBE_API_KEY`.

