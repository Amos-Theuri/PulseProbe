# Contributing to PulseProbe

Thank you for your interest in contributing to PulseProbe! Whether you are reporting a bug, improving documentation, or submitting a feature pull request, your contributions are welcome.

---

## Code of Conduct

All contributors and participants are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## Development Setup

1. **Fork and Clone the Repository**
   ```bash
   git clone https://github.com/<your-username>/PulseProbe.git
   cd PulseProbe
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Copy the example environment configuration:
   ```bash
   cp .env.example .env
   ```
   *Note: PulseProbe includes an automated fallback memory store so you can develop and run tests even without a local PostgreSQL instance running.*

4. **Generate Prisma Client**
   ```bash
   npm run prisma:generate
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Submitting Pull Requests

Before submitting a pull request, ensure all checks pass:

1. **Run Unit & Integration Tests**
   ```bash
   npm test
   ```
   *All 20+ test suites covering SSRF filtering, uptime calculations, and probe engines must pass.*

2. **Run Linter**
   ```bash
   npm run lint
   ```
   *Ensure 0 errors and 0 warnings are reported.*

3. **Verify Production Build**
   ```bash
   npm run build
   ```

### Pull Request Guidelines

- Branch names should follow conventional format: `feat/feature-name`, `fix/bug-description`, `docs/improvement`.
- Keep changes atomic and well-documented.
- If introducing new probe capabilities or API routes, include corresponding tests under the `tests/` directory.
- Do not commit sensitive environment files (`.env`, `.neon`, credentials).

