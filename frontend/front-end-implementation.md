# Teach-It-Back Consent Companion — Front-End Implementation Plan

> **Objective:** Build a production-grade, accessible, and beautifully polished front-end for the Teach-It-Back Consent Companion — an AI-powered informed consent system for healthcare. The app serves two distinct user groups: **Patients** (low-friction, calming, literacy-aware) and **Clinical Coordinators** (information-dense, action-oriented, efficient).

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│                    Vite 6+ Dev Server                  │
├────────────────────────────────────────────────────────┤
│  React 19 + TypeScript 5.x                             │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────┐ │
│  │ React Router  │ │   Zustand    │ │ TanStack Query │ │
│  │    v7         │ │  (stores)    │ │ (server state) │ │
│  └──────────────┘ └──────────────┘ └────────────────┘ │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────┐ │
│  │ Tailwind v4   │ │  shadcn/ui   │ │ Radix UI       │ │
│  │ + Design Sys  │ │  primitives  │ │ accessibility  │ │
│  └──────────────┘ └──────────────┘ └────────────────┘ │
│  ┌──────────────┐ ┌──────────────┐                     │
│  │ React Hook   │ │ ElevenLabs      │                     │
│  │ Form + Zod   │ │ Conv. AI SDK   │                     │
│  └──────────────┘ └──────────────┘                     │
├────────────────────────────────────────────────────────┤
│        REST API (OpenAPI) ← http://localhost:8000      │
│        WebSocket (real-time session updates)           │
│        ElevenLabs Server (voice streaming)                │
└────────────────────────────────────────────────────────┘
```

---

## Phase 1: Project Scaffolding & Core Infrastructure

> **Goal:** Establish a rock-solid foundation — Vite scaffold, design system tokens, routing skeleton, API client, auth flow, and shared primitives. Every subsequent phase builds on this.

### 1.1 — Vite + React + TypeScript Scaffold

| Task | Detail | Output |
|------|--------|--------|
| Initialize project | `npm create vite@latest . -- --template react-ts` | `vite.config.ts`, `tsconfig.json`, `package.json` |
| Install core deps | React 19, React DOM 19, TypeScript 5.x | Updated `package.json` |
| Configure path aliases | `@/` → `./src` in both `tsconfig.app.json` and `vite.config.ts` | Clean imports across codebase |
| Install Tailwind CSS v4 | `@tailwindcss/vite` plugin, `@import "tailwindcss"` in `index.css` | Tailwind working in dev |
| Install shadcn/ui | `npx shadcn@latest init` (New York style, neutral, CSS variables) | `components.json`, `lib/utils.ts` |
| Configure ESLint + Prettier | Strict TypeScript rules, Tailwind plugin, import sorting | `.eslintrc.cjs`, `.prettierrc` |

### 1.2 — Design System Token Layer

> This is the single most important infrastructure step. Every component inherits from these tokens.

**File:** `src/styles/design-tokens.css`

| Token Category | Values | Notes |
|----------------|--------|-------|
| `--color-cream` | `#f7f4ed` | Page background — **never white** |
| `--color-charcoal` | `#1c1c1c` | Primary text, dark surfaces |
| `--color-off-white` | `#fcfbf8` | Button text on dark bg |
| `--color-muted` | `#5f5f5d` | Secondary text, descriptions |
| `--color-border-passive` | `#eceae4` | Card borders, dividers |
| `--color-border-interactive` | `rgba(28,28,28,0.4)` | Interactive element borders |
| `--color-charcoal-83` | `rgba(28,28,28,0.83)` | Strong secondary text |
| `--color-charcoal-04` | `rgba(28,28,28,0.04)` | Hover backgrounds |
| `--color-charcoal-03` | `rgba(28,28,28,0.03)` | Subtle overlays |
| `--shadow-inset-button` | Multi-layer inset (see design-system.md §4) | Signature tactile button |
| `--shadow-focus` | `rgba(0,0,0,0.1) 0px 4px 12px` | Focus/active glow |
| `--radius-micro` | `4px` | Small interactive elements |
| `--radius-standard` | `6px` | Buttons, inputs |
| `--radius-comfortable` | `8px` | Compact cards |
| `--radius-card` | `12px` | Standard cards |
| `--radius-container` | `16px` | Large containers |
| `--radius-pill` | `9999px` | Action pills, icon buttons |

**File:** `src/styles/typography.css`

- Load `Camera Plain Variable` font (self-hosted `.woff2` in `public/fonts/`)
- Define CSS classes for the full type hierarchy (Display Hero → Caption)
- Enforce letter-spacing rules: `-1.5px` at 60px, `-1.2px` at 48px, `-0.9px` at 36px, `normal` below

**File:** `tailwind.config.ts` extensions (or Tailwind v4 `@theme` block in CSS)

- Extend colors, spacing (8px base), border-radius, box-shadow, and font-family to match design tokens
- Map design system breakpoints to Tailwind breakpoints

### 1.3 — Shared UI Primitives (shadcn/ui + Custom)

Generate and customize the following shadcn/ui components to match the design system:

| Component | shadcn base | Customization |
|-----------|-------------|---------------|
| `Button` | `npx shadcn add button` | 4 variants: Primary Dark (inset shadow), Ghost/Outline, Cream Surface, Pill/Icon. All use design-system radii, colors, and shadows. |
| `Card` | `npx shadcn add card` | Cream bg, `#eceae4` border, 12px radius, no box-shadow. |
| `Input` | `npx shadcn add input` | Cream bg, `#eceae4` border, blue focus ring. |
| `Dialog` / `Modal` | `npx shadcn add dialog` | Cream overlay, warm backdrop blur, smooth spring animation. |
| `Badge` | `npx shadcn add badge` | Warm-neutral palette for status indicators (passed/failed/pending). |
| `Skeleton` | `npx shadcn add skeleton` | Cream-toned pulse animation for loading states. |
| `Tooltip` | `npx shadcn add tooltip` | Charcoal bg, off-white text, 6px radius. |
| `Progress` | `npx shadcn add progress` | Section progress bar for teach-back sessions. |
| `Tabs` | `npx shadcn add tabs` | For dashboard section switching. |
| `Toast` | `npx shadcn add sonner` | Success/error/info notifications with warm styling. |
| `DropdownMenu` | `npx shadcn add dropdown-menu` | User menu, actions menu. |
| `Sheet` | `npx shadcn add sheet` | Mobile navigation drawer. |
| `ScrollArea` | `npx shadcn add scroll-area` | Chat message scroll container. |
| `Avatar` | `npx shadcn add avatar` | User/AI avatar in chat. |
| `Separator` | `npx shadcn add separator` | `#eceae4` dividers. |

### 1.4 — Routing Architecture

**File:** `src/router.tsx`

```
/                              → Landing / Entry (redirect logic)

── Patient Portal ──
/session/:sessionId            → Patient entry point (identity verification)
/session/:sessionId/overview   → Procedure overview
/session/:sessionId/chat       → Teach-back chat session
/session/:sessionId/voice      → Teach-back voice session
/session/:sessionId/summary    → Session summary & consent

── Clinical Coordinator Dashboard ──
/login                         → Coordinator login
/dashboard                     → Dashboard home (session overview)
/dashboard/documents           → ICF document management
/dashboard/documents/:id       → Document detail / section editor
/dashboard/sessions            → Patient session list
/dashboard/sessions/new        → Create new session
/dashboard/sessions/:id        → Session detail & monitoring
/dashboard/sessions/:id/report → Understanding report
/dashboard/settings            → Configuration & preferences
```

**Route guards:**
- `ProtectedRoute` — requires coordinator auth token
- `SessionRoute` — validates session ID + patient identity
- `PublicRoute` — login, landing

**Layouts:**
- `PatientLayout` — minimal chrome, calming, no nav clutter
- `DashboardLayout` — sidebar nav, header with user menu, breadcrumbs

### 1.5 — API Client & Server State

**File:** `src/lib/api-client.ts`

- Create a typed Axios (or `fetch` wrapper) instance pointing to `http://localhost:8000`
- Request interceptor: attach `Authorization: Bearer <token>` from auth store
- Response interceptor: handle 401 → redirect to login, 422 → surface validation errors, 500 → error boundary
- Optional: auto-generate types from OpenAPI spec using `openapi-typescript`

**File:** `src/lib/query-client.ts`

- Configure TanStack Query `QueryClient` with sensible defaults:
  - `staleTime: 30_000` (30s)
  - `retry: 2`
  - `refetchOnWindowFocus: true`
- Wrap app in `QueryClientProvider`

**Files:** `src/api/*.ts` — domain-specific query/mutation hooks:

| Module | Hooks | API Endpoints |
|--------|-------|---------------|
| `auth.ts` | `useLogin`, `useLogout`, `useCurrentUser` | `POST /auth/login`, `GET /auth/me` |
| `documents.ts` | `useDocuments`, `useDocument`, `useUploadDocument`, `useDeleteDocument` | `GET/POST/DELETE /documents` |
| `sessions.ts` | `useSessions`, `useSession`, `useCreateSession`, `useSessionStatus` | `GET/POST /sessions` |
| `chat.ts` | `useSendMessage`, `useChatHistory` | `POST /sessions/:id/chat`, `GET /sessions/:id/chat/history` |
| `voice.ts` | `useVoiceToken` | `GET /sessions/:id/voice/token` |
| `reports.ts` | `useReport`, `useReports` | `GET /sessions/:id/report`, `GET /reports` |

### 1.6 — State Management (Zustand)

**Files:** `src/stores/*.ts`

| Store | State | Purpose |
|-------|-------|---------|
| `auth-store.ts` | `token`, `user`, `isAuthenticated`, `login()`, `logout()` | Coordinator auth state |
| `session-store.ts` | `currentSection`, `completedSections`, `mode` (chat/voice), `progress` | Patient session progress |
| `ui-store.ts` | `sidebarOpen`, `mobileMenuOpen`, `theme` | Global UI state |

### 1.7 — Error Handling & Loading Infrastructure

| Item | Implementation |
|------|----------------|
| `ErrorBoundary` component | React error boundary with warm, calming fallback UI |
| `NotFound` page | 404 with return-to-home CTA |
| `LoadingSkeleton` system | Per-page skeleton layouts that match final content structure |
| Global toast notifications | `sonner` configured with design system colors |
| Form error handling | Zod validation with inline error messages styled in warm red |

### 1.8 — Accessibility Foundation

| Item | Implementation |
|------|----------------|
| Skip-to-content link | Hidden link at top of page, visible on focus |
| Focus management | Programmatic focus on route change, modal open/close |
| ARIA live regions | For chat messages, voice status, loading states |
| Reduced motion | `prefers-reduced-motion` media query disables animations |
| Color contrast | All text meets WCAG 2.1 AA (4.5:1 body, 3:1 large) |
| Keyboard navigation | Full keyboard support on all interactive elements |
| Screen reader labels | `aria-label` / `aria-describedby` on all icons and non-text elements |

### Phase 1 — File Structure

```
src/
├── api/                    # TanStack Query hooks per domain
│   ├── auth.ts
│   ├── documents.ts
│   ├── sessions.ts
│   ├── chat.ts
│   ├── voice.ts
│   └── reports.ts
├── components/
│   ├── ui/                 # shadcn/ui primitives (customized)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── dialog.tsx
│   │   ├── badge.tsx
│   │   ├── skeleton.tsx
│   │   ├── progress.tsx
│   │   ├── tabs.tsx
│   │   ├── toast.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── sheet.tsx
│   │   ├── scroll-area.tsx
│   │   ├── avatar.tsx
│   │   └── separator.tsx
│   ├── layout/             # Layout shells
│   │   ├── patient-layout.tsx
│   │   ├── dashboard-layout.tsx
│   │   ├── sidebar.tsx
│   │   └── header.tsx
│   └── shared/             # Cross-cutting components
│       ├── error-boundary.tsx
│       ├── loading-skeleton.tsx
│       ├── skip-to-content.tsx
│       └── not-found.tsx
├── hooks/                  # Custom React hooks
│   ├── use-media-query.ts
│   └── use-debounce.ts
├── lib/                    # Utility layer
│   ├── api-client.ts
│   ├── query-client.ts
│   ├── utils.ts            # cn() + helpers
│   └── validators.ts       # Zod schemas
├── stores/                 # Zustand stores
│   ├── auth-store.ts
│   ├── session-store.ts
│   └── ui-store.ts
├── styles/
│   ├── design-tokens.css   # CSS custom properties
│   ├── typography.css      # Font loading + type classes
│   └── index.css           # Tailwind imports + global styles
├── types/                  # TypeScript type definitions
│   ├── api.ts              # API response/request types
│   ├── session.ts          # Session, Section, Message types
│   └── user.ts             # User, Coordinator types
├── router.tsx              # React Router v7 config
├── App.tsx                 # Root component (providers)
└── main.tsx                # Entry point
```

### Phase 1 — Acceptance Criteria

- [ ] `npm run dev` boots with zero errors
- [ ] Design tokens render correctly (cream bg, charcoal text, Camera Plain font)
- [ ] All shadcn/ui components render with design system styling
- [ ] Routing works — navigating between patient and dashboard routes
- [ ] API client makes authenticated requests to backend
- [ ] Auth flow works end-to-end (login → token stored → protected routes)
- [ ] Error boundary catches and displays runtime errors gracefully
- [ ] Loading skeletons appear during data fetching
- [ ] Keyboard navigation works on all interactive elements
- [ ] No a11y violations in axe-core audit

---

## Phase 2: Clinical Coordinator Dashboard

> **Goal:** Build the complete coordinator experience — login, document management, session creation, and real-time monitoring. This is the "admin" side where clinical staff operate.

### 2.1 — Login Page

**File:** `src/pages/login.tsx`

| Element | Detail |
|---------|--------|
| Layout | Centered card on cream bg, max-width 400px |
| Form fields | Email (validated), Password (min 8 chars) |
| Validation | React Hook Form + Zod schema |
| Submit | Primary Dark button with loading spinner |
| Error state | Inline error below field, toast for server errors |
| Remember me | Optional checkbox |
| Redirect | On success → `/dashboard` |

### 2.2 — Dashboard Home

**File:** `src/pages/dashboard/index.tsx`

| Element | Detail |
|---------|--------|
| Stats bar | Active sessions count, pending reviews, documents uploaded — large 48px numbers with muted labels |
| Recent sessions table | Sortable by date, status badges (Active / Completed / Needs Review) |
| Quick actions | "New Session" button, "Upload Document" button |
| Empty state | Warm illustration + CTA when no sessions exist |

### 2.3 — ICF Document Management

**Files:**
- `src/pages/dashboard/documents/index.tsx` — document list
- `src/pages/dashboard/documents/[id].tsx` — document detail
- `src/components/dashboard/document-upload.tsx` — upload modal

| Feature | Detail |
|---------|--------|
| Document list | Cards showing title, upload date, section count, status badge |
| Upload flow | Drag-and-drop zone + file picker → upload progress bar → AI parsing status → section preview |
| File validation | PDF only, max size, graceful error messages for invalid files |
| Section management | Accordion-style section list from parsed ICF, ability to edit/reorder |
| Delete | Confirmation dialog with warm, reassuring copy |
| Error handling | Outdated version warning, parse failure recovery with retry |

> [!IMPORTANT]
> The upload UI must be exceptionally intuitive per the action items. Use a large, inviting drop zone with clear visual feedback (border-dashed → solid on drag, pulse animation on processing). Show AI parsing progress with a warm, reassuring skeleton that reveals sections as they're extracted.

### 2.4 — Patient Session Management

**Files:**
- `src/pages/dashboard/sessions/index.tsx` — session list
- `src/pages/dashboard/sessions/new.tsx` — create session
- `src/pages/dashboard/sessions/[id].tsx` — session detail

| Feature | Detail |
|---------|--------|
| Session list | Filterable table: patient name, document, status, date, progress |
| Create session | Form: select ICF document, enter patient info, generate unique link |
| Unique link | Copy-to-clipboard with visual confirmation, QR code option |
| Session detail | Real-time status card, section progress, timestamps |
| Status tracking | Live progress indicator showing which section patient is on |

### 2.5 — Understanding Report

**File:** `src/pages/dashboard/sessions/[id]/report.tsx`

> [!IMPORTANT]
> This is the highest-value screen in the coordinator dashboard. Per the action items, it must be **instantly actionable** — nurses need to glance at it and immediately know what to do.

| Element | Detail |
|---------|--------|
| Overall score | Large visual indicator (circular progress or clear pass/fail) |
| Section breakdown | Per-section cards with pass ✓ / fail ✗ / partial ⚠ badges |
| Failed sections | **Red-highlighted cards** floated to top with "Needs Follow-Up" flag |
| Out-of-scope questions | Separate section listing questions the AI couldn't answer — flagged for nurse |
| Patient responses | Expandable accordion showing exact patient teach-back responses per section |
| Actions | "Flag for Nurse Follow-Up" button, "Download Report" button, "Schedule Follow-Up" |
| Print view | `@media print` stylesheet for clean printable report |

**Report card anatomy:**
```
┌─────────────────────────────────────────────┐
│  ⚠ NEEDS REVIEW                   Section 3 │
│  ─────────────────────────────────────────── │
│  "Risks and Side Effects"                    │
│                                              │
│  Patient's Response:                         │
│  "The medicine might make me feel dizzy..."  │
│                                              │
│  AI Assessment:                              │
│  Partial understanding — missed mention of   │
│  allergic reactions and long-term effects.   │
│                                              │
│  ┌─────────────────┐ ┌──────────────────┐   │
│  │ Flag for Nurse  │ │ View Full Chat   │   │
│  └─────────────────┘ └──────────────────┘   │
└─────────────────────────────────────────────┘
```

### 2.6 — Settings Page

**File:** `src/pages/dashboard/settings.tsx`

| Section | Fields |
|---------|--------|
| AI Behavior | Teach-back strictness level, retry attempts before flagging |
| Consent Workflow | Auto-advance sections vs. manual, require voice confirmation |
| Notifications | Email alerts for completed sessions, failed sections |
| Account | Change password, manage coordinators (if admin role) |

### Phase 2 — File Structure (additions)

```
src/
├── pages/
│   ├── login.tsx
│   └── dashboard/
│       ├── index.tsx           # Dashboard home
│       ├── documents/
│       │   ├── index.tsx       # Document list
│       │   └── [id].tsx        # Document detail
│       ├── sessions/
│       │   ├── index.tsx       # Session list
│       │   ├── new.tsx         # Create session
│       │   └── [id]/
│       │       ├── index.tsx   # Session detail
│       │       └── report.tsx  # Understanding report
│       └── settings.tsx
├── components/
│   └── dashboard/
│       ├── document-upload.tsx
│       ├── document-card.tsx
│       ├── session-table.tsx
│       ├── session-card.tsx
│       ├── stats-bar.tsx
│       ├── report-section-card.tsx
│       ├── report-score.tsx
│       ├── sidebar-nav.tsx
│       └── empty-state.tsx
```

### Phase 2 — Acceptance Criteria

- [ ] Coordinator can log in and see dashboard with real data
- [ ] ICF document upload works end-to-end with progress and error handling
- [ ] Parsed sections display correctly from uploaded documents
- [ ] Sessions can be created and unique patient links generated
- [ ] Understanding report clearly highlights failed sections and out-of-scope questions
- [ ] All forms validate with inline Zod errors
- [ ] Tables are sortable and filterable
- [ ] Empty states are warm and helpful, not dead-end
- [ ] Settings changes persist
- [ ] All pages are fully responsive (tablet + mobile)

---

## Phase 3: Patient-Facing Portal

> **Goal:** Build the complete patient journey — from opening the unique link to completing consent. This is where the design system's warmth, accessibility, and cognitive-load reduction matter most.

### 3.1 — Patient Onboarding / Identity Verification

**File:** `src/pages/session/index.tsx`

| Element | Detail |
|---------|--------|
| Entry point | Patient opens unique URL (`/session/:sessionId`) |
| Identity check | Simple form: full name + date of birth (matches coordinator-entered data) |
| Language preference | Language selector (initially English, expandable) |
| Validation | Gentle inline errors ("Please check your date of birth") — never clinical or harsh |
| Loading | Warm skeleton while session data loads |
| Invalid link | Friendly error page: "This link may have expired. Please contact your care team." |

> [!TIP]
> The onboarding screen is the patient's very first impression. It must feel calming, not like a hospital form. Use generous whitespace, large touch targets (46px+ height), and friendly copy. Consider a subtle warm gradient header.

### 3.2 — AI Introduction & Compliance Screen

**File:** `src/pages/session/overview.tsx`

| Element | Detail |
|---------|--------|
| AI disclosure | Clear, prominent statement: "I'm an AI assistant — not a doctor or nurse." |
| Procedure summary | AI-generated plain-language summary of the ICF document |
| Section preview | Visual list of sections the patient will review (clickable) |
| Mode selection | Toggle between Chat and Voice mode with clear descriptions |
| Start CTA | Large Primary Dark button: "I'm Ready to Begin" |

> [!IMPORTANT]
> Per the action items, the AI must **clearly introduce itself as an AI, not a human doctor**. This is a compliance requirement. The disclosure must be visually prominent — not buried in fine print.

### 3.3 — Section Navigation & Progress

**File:** `src/components/patient/section-progress.tsx`

| Element | Detail |
|---------|--------|
| Progress bar | Horizontal progress indicator showing completed/total sections |
| Section chips | Clickable chips for each section: pending (outline), current (solid), completed (check) |
| Current section highlight | Clear visual indicator of which section is active |
| Non-overwhelming UX | Show only 1 section at a time, with peek at next section name |

### 3.4 — Chat Interface

**Files:**
- `src/pages/session/chat.tsx` — chat page
- `src/components/patient/chat-bubble.tsx` — message bubble
- `src/components/patient/chat-input.tsx` — input area
- `src/components/patient/typing-indicator.tsx` — AI typing animation

| Element | Detail |
|---------|--------|
| Message list | Scrollable area with clear AI (left, avatar) vs. Patient (right, accent) demarcation |
| AI messages | Cream card with charcoal text, AI avatar, timestamp |
| Patient messages | Slightly darker cream card, right-aligned |
| Typing indicator | Three animated dots in AI message style — smooth, calming pulse |
| Input area | Large text input with rounded border, send button (pill shape), voice toggle |
| Suggestion chips | Quick-response pills below AI messages for common answers |
| Auto-scroll | Smooth scroll to bottom on new message, with "scroll to bottom" FAB if scrolled up |
| Section transition | Smooth visual transition when AI moves to next section |
| Accessibility | ARIA live region for new messages, focus management |

**Chat bubble anatomy:**
```
┌──────────────────────────────────────┐
│  🤖 AI Assistant          2:34 PM   │
│  ─────────────────────────────────── │
│  Can you tell me in your own words   │
│  what the main risks of this         │
│  procedure are?                      │
│                                      │
│  ┌────────┐ ┌──────────┐ ┌───────┐  │
│  │ Risks  │ │ Side     │ │ I'm   │  │
│  │ I know │ │ effects  │ │ unsure│  │
│  └────────┘ └──────────┘ └───────┘  │
└──────────────────────────────────────┘
```

### 3.5 — Session Summary & Consent

**File:** `src/pages/session/summary.tsx`

| Element | Detail |
|---------|--------|
| Understanding overview | Per-section summary: pass/needs-review indicators |
| Areas needing review | Highlighted sections where understanding was partial |
| Key takeaways | AI-generated plain-language summary of what patient learned |
| Digital consent | Checkbox acknowledgment + signature pad (or typed name) |
| Submit | Primary Dark button: "I Understand and Consent" |
| Confirmation | Warm thank-you screen with next-steps information |

### Phase 3 — File Structure (additions)

```
src/
├── pages/
│   └── session/
│       ├── index.tsx          # Identity verification
│       ├── overview.tsx       # AI intro + procedure overview
│       ├── chat.tsx           # Chat-based teach-back
│       ├── voice.tsx          # Voice-based teach-back (Phase 4)
│       └── summary.tsx        # Summary + consent signature
├── components/
│   └── patient/
│       ├── chat-bubble.tsx
│       ├── chat-input.tsx
│       ├── typing-indicator.tsx
│       ├── suggestion-chips.tsx
│       ├── section-progress.tsx
│       ├── ai-disclosure.tsx
│       ├── consent-signature.tsx
│       ├── language-selector.tsx
│       └── session-expired.tsx
```

### Phase 3 — Acceptance Criteria

- [ ] Patient can open unique link and verify identity
- [ ] AI introduction is visually prominent and compliant
- [ ] Chat interface has smooth typing indicators and clear user/AI demarcation
- [ ] Section navigation shows progress without overwhelming
- [ ] Messages auto-scroll and support keyboard navigation
- [ ] ARIA live regions announce new messages to screen readers
- [ ] Summary page shows per-section understanding status
- [ ] Digital consent capture works (signature or typed name)
- [ ] All pages responsive on iPad (primary in-clinic) and mobile (at-home)
- [ ] Touch targets are 44px+ on all interactive elements

---

## Phase 4: Real-Time Features & Voice

> **Goal:** Layer in WebSocket-based real-time updates and the ElevenLabs Conversational AI voice interface. These are the most technically complex features.

### 4.1 — WebSocket / Polling for Real-Time Updates

**File:** `src/hooks/use-realtime.ts`

| Feature | Detail |
|---------|--------|
| Strategy | WebSocket primary, long-polling fallback |
| Events | Session status changes, new chat messages, report updates |
| Reconnection | Exponential backoff with visual "reconnecting" indicator |
| Coordinator dashboard | Live session status updates without page refresh |
| Optimistic updates | Immediate UI response on send, reconcile with server |

### 4.2 — ElevenLabs Voice Interface

**Files:**
- `src/pages/session/voice.tsx` — voice session page
- `src/components/patient/voice-visualizer.tsx` — audio waveform
- `src/components/patient/voice-status.tsx` — state indicator
- `src/hooks/use-elevenlabs.ts` — ElevenLabs connection hook

| State | Visual | Detail |
|-------|--------|--------|
| Connecting | Pulsing circle + "Connecting..." | ElevenLabs room join in progress |
| Listening | Animated waveform + "I'm listening..." | Microphone active, AI receiving audio |
| Thinking | Subtle orbiting dots + "Processing..." | AI generating response |
| Speaking | Larger waveform + "Speaking..." | AI audio playing back |
| Paused | Static circle + "Tap to continue" | Session paused |
| Error | Warm error card + retry button | Mic permission denied, connection lost |

**Voice UI anatomy:**
```
┌─────────────────────────────────────────┐
│                                         │
│         Section 2 of 5                  │
│     "Risks and Side Effects"            │
│                                         │
│            ┌─────────┐                  │
│            │  ◉◉◉◉◉  │  ← waveform     │
│            │  ◉◉◉◉◉  │                  │
│            └─────────┘                  │
│                                         │
│          🎤 Listening...                │
│                                         │
│   ┌─────────┐          ┌────────────┐   │
│   │  Pause  │          │ Switch to  │   │
│   │         │          │   Chat     │   │
│   └─────────┘          └────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

**Technical requirements:**
- Request microphone permission with friendly, non-technical prompt
- Handle permission denial gracefully (fallback to chat)
- Audio level visualization using Web Audio API `AnalyserNode`
- Smooth transitions between states (spring-based, per design system)
- Mute/unmute toggle
- End session button with confirmation

### 4.3 — Real-Time Report Updates (Coordinator Side)

| Feature | Detail |
|---------|--------|
| Live session monitor | Real-time section progress as patient completes teach-back |
| Report generation | Report appears in real-time as AI evaluates each section |
| Notifications | Toast when a session completes or a section fails |

### Phase 4 — File Structure (additions)

```
src/
├── hooks/
│   ├── use-realtime.ts      # WebSocket/polling hook
│   ├── use-elevenlabs.ts       # ElevenLabs connection management
│   └── use-audio-level.ts   # Web Audio API visualizer
├── components/
│   └── patient/
│       ├── voice-visualizer.tsx
│       ├── voice-status.tsx
│       ├── mic-permission.tsx
│       └── mode-switcher.tsx  # Chat ↔ Voice toggle
```

### Phase 4 — Acceptance Criteria

- [ ] Voice session connects to ElevenLabs server and streams audio
- [ ] Visual states (Listening/Thinking/Speaking) transition smoothly
- [ ] Audio waveform visualizes mic input level in real-time
- [ ] Graceful fallback when mic permission is denied
- [ ] Chat ↔ Voice mode switching preserves session state
- [ ] WebSocket delivers real-time session updates to coordinator dashboard
- [ ] Report updates appear live as patient progresses
- [ ] Reconnection handles network interruptions gracefully
- [ ] All voice UI elements are keyboard-accessible
- [ ] Screen readers announce state changes via ARIA live regions

---

## Phase 5: Polish & Production Readiness

> **Goal:** The final push — micro-interactions, performance optimization, comprehensive testing, and production hardening. This is what separates a demo from a product.

### 5.1 — Micro-Interactions & Animation

| Animation | Technique | Location |
|-----------|-----------|----------|
| Page transitions | `View Transitions API` or Framer Motion `AnimatePresence` | Route changes |
| Chat message entry | Slide-up + fade-in (spring-based) | New messages |
| Button press | Scale 0.98 + opacity 0.8 on `:active` | All buttons |
| Section completion | Confetti micro-burst or checkmark animation | Section pass |
| Progress bar fill | CSS transition with ease-out curve | Section progress |
| Skeleton shimmer | Warm cream gradient pulse | Loading states |
| Toast entrance | Slide-in from top with spring physics | Notifications |
| Modal backdrop | Cream-tinted backdrop-blur fade-in | Dialogs |

### 5.2 — Performance Optimization

| Technique | Implementation |
|-----------|----------------|
| Code splitting | React.lazy + Suspense per route (patient portal vs. dashboard) |
| Bundle analysis | `rollup-plugin-visualizer` to audit chunk sizes |
| Image optimization | WebP/AVIF with `<picture>` element, lazy loading |
| Font loading | `font-display: swap`, preload Camera Plain Variable |
| Prefetching | React Router `loader` for route data prefetching |
| Virtual scrolling | `@tanstack/react-virtual` for long chat message lists |
| Memoization | `React.memo`, `useMemo`, `useCallback` on hot paths |
| Service worker | Offline-capable shell for patient portal (in-clinic reliability) |

### 5.3 — Testing Strategy

| Layer | Tool | Coverage Target |
|-------|------|-----------------|
| Unit | Vitest + React Testing Library | All utility functions, Zod schemas, store logic |
| Component | Vitest + RTL | All shadcn/ui customizations, form components, chat bubbles |
| Integration | Vitest + MSW (Mock Service Worker) | API flows: login, document upload, chat, session lifecycle |
| E2E | Playwright | Critical paths: coordinator login → create session → patient completes → report |
| Accessibility | axe-core + Playwright a11y | Zero violations on all pages |
| Visual regression | Playwright screenshot comparison | Design system consistency |

### 5.4 — Production Hardening

| Item | Implementation |
|------|----------------|
| Environment config | `.env` files: `VITE_API_URL`, `VITE_ELEVENLABS_AGENT_ID`, `VITE_WS_URL` |
| CSP headers | Content Security Policy for XSS protection |
| Error tracking | Sentry integration with source maps |
| Analytics | Privacy-respecting event tracking (if needed) |
| Build optimization | Vite production build with chunk splitting, minification, compression |
| CI/CD | GitHub Actions: lint → type-check → test → build → deploy |
| Preview deployments | PR preview URLs for design review |

### 5.5 — Documentation

| Document | Content |
|----------|---------|
| `README.md` | Setup instructions, env vars, architecture overview |
| `CONTRIBUTING.md` | Code style, PR process, component guidelines |
| Component Storybook (optional) | Interactive design system documentation |

### Phase 5 — Acceptance Criteria

- [ ] All animations feel smooth at 60fps, no jank
- [ ] Lighthouse performance score ≥ 90
- [ ] Lighthouse accessibility score = 100
- [ ] All critical paths covered by E2E tests
- [ ] Zero axe-core violations
- [ ] Bundle size < 250KB gzipped (excluding ElevenLabs SDK)
- [ ] First Contentful Paint < 1.5s
- [ ] `prefers-reduced-motion` disables all non-essential animations
- [ ] Production build deploys without errors
- [ ] Error tracking captures and reports runtime errors

---

## Dependency Installation Summary

```bash
# Core
npm install react@^19 react-dom@^19

# Routing
npm install react-router@^7

# State & Data
npm install zustand @tanstack/react-query axios

# Forms & Validation
npm install react-hook-form @hookform/resolvers zod

# UI
npm install tailwindcss@^4 @tailwindcss/vite
npx shadcn@latest init  # then add components as needed
npm install lucide-react

# Voice / Real-time
npm install @elevenlabs/client

# Animation (optional, if not using CSS-only)
npm install framer-motion

# Dev
npm install -D vitest @testing-library/react @testing-library/jest-dom
npm install -D playwright @playwright/test
npm install -D msw
npm install -D @tanstack/react-virtual
npm install -D rollup-plugin-visualizer
```

---

## Timeline Estimate

| Phase | Duration | Parallelizable? |
|-------|----------|-----------------|
| Phase 1: Scaffolding & Infrastructure | 3–4 days | No — foundation for everything |
| Phase 2: Coordinator Dashboard | 5–7 days | No — depends on Phase 1 |
| Phase 3: Patient Portal | 5–7 days | Partially with Phase 2 (shared components) |
| Phase 4: Real-time & Voice | 4–5 days | Partially with Phase 3 |
| Phase 5: Polish & Production | 3–4 days | After all features stable |
| **Total** | **~20–27 days** | |

---

## Key Design Decisions & Rationale

1. **Separate layouts for Patient vs. Coordinator**: Patients need a calming, minimal UI. Coordinators need information density. Sharing a layout would compromise both.

2. **Zustand for client state, TanStack Query for server state**: Clean separation of concerns. Zustand is lightweight for UI/session state. TanStack Query handles caching, deduplication, and background refetching of API data.

3. **shadcn/ui as component foundation**: Copy-paste model means we own the code and can deeply customize to the design system without fighting a library's opinions.

4. **Zod schemas shared between forms and API**: Single source of truth for validation — define once, use in React Hook Form and API response parsing.

5. **ElevenLabs Conversational AI**: Using ElevenLabs handles the brutal complexity of real-time voice (VAD, turn-taking, STT, TTS) so we can focus on the UX.

6. **CSS custom properties for design tokens**: Framework-agnostic, works with Tailwind, enables potential theming, and makes the design system auditable.

7. **Mobile-first responsive approach**: The patient portal is primarily used on iPad (in-clinic) and mobile (at-home). Desktop is secondary for the coordinator dashboard.
