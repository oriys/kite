# CLAUDE.md

## Design Context

### Users

Three primary user roles interact with this system:

1. **API Platform Editors** — Create and maintain API documentation, configure endpoints, manage versioning. They need efficient editing workflows with clear visual feedback.
2. **Reviewers / Auditors** — Review API documentation for accuracy and completeness before publication. They need to scan dense information quickly and flag issues.
3. **API Documentation Readers** — Developers consuming the published docs to integrate APIs. They need to find endpoints fast, understand request/response schemas, and test interactively.

All users operate in a focused, task-driven context — scanning structured technical content, not browsing casually.

### Brand Personality

**Three words:** Neutral · Professional · Accurate (中立 · 专业 · 准确)

**Voice & Tone:**
- Authoritative but approachable — like a well-written technical reference
- Never flashy, never vague — every element serves an informational purpose
- Confidence through restraint: the design proves reliability by not overselling

**Emotional goals:** Users should feel **trust and confidence** — that the documentation is correct, the platform is stable, and the system is well-maintained.

### Aesthetic Direction

**Visual tone:** Calm editorial — paper-first surfaces, warm neutrals, minimal accent color. Dense information separated by whitespace, not decorative chrome.

**References:**
- **Stripe Docs** — Clean hierarchy, excellent code samples, calm color palette
- **Notion** — Content-first layout, minimal UI noise, composable blocks
- **Vercel Docs** — Monochrome base, sharp typography, fast scanability

**Anti-references:**
- No rainbow/multicolor palettes — avoid "五彩斑斓" (garish, overly colorful)
- No heavy/dense visual weight — avoid thick borders, heavy shadows, saturated fills
- No gamified or playful UI patterns
- No legacy cluttered doc layouts (old Swagger UI, Javadoc)

**Theme:** Both light and dark mode, fully supported. OKLCH color space for perceptually uniform tones.

### Design Principles

1. **Quiet hierarchy** — Use spacing, typography weight, and subtle tone shifts to create structure. Never rely on loud color or heavy borders to separate content.

2. **Content density over decoration** — Maximize information per viewport. Prefer compact, well-spaced layouts over large hero sections or decorative cards. Every pixel should serve readability.

3. **One accent, used sparingly** — The cool blue accent (hue 244°) marks focus, selection, and interactive state only. Everything else stays in the warm neutral range.

4. **Paper-surface language** — Backgrounds feel like layered paper: slight opacity differences, hairline borders, and soft shadows create depth without heaviness.

5. **Accuracy signals trust** — Precise alignment, consistent spacing, correct typography scales. Small details (monospace for code, uppercase kickers for sections, proper HTTP method colors) reinforce that the system is built with care.

### Technical Foundation

- **Framework:** Next.js 16 + React 19, TypeScript
- **Styling:** Tailwind CSS v4 with OKLCH custom properties
- **Components:** 58 shadcn/ui components (New York style, RSC enabled)
- **Icons:** Lucide React
- **Animation:** Framer Motion + editorial-reveal keyframes
- **Font stack:** Geist (sans) + Geist Mono (monospace)
- **Base radius:** 0.375rem (6px) — sharper corners for denser product surfaces
- **Shadow system:** Layered compound shadows with rgba opacity for subtle depth
- **Color tokens:** Warm neutrals (hue 85–95°) for surfaces, cool blue (hue 244°) for interaction, semantic colors for status (emerald/amber/rose)
- **Accessibility:** WCAG AA compliance, focus-visible rings, aria-invalid states, reduced-motion consideration
