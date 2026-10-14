# QA Documentation

Quality Assurance Document Management System — UI prototype.

A centralized workspace for managing controlled quality documents, revisions,
approvals, and compliance records. Built for daily use by an industrial QA
department operating under IATF 16949 / ISO 9001.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · Ant Design 6 · React Router ·
Lucide React · Day.js

Ant Design supplies component behaviour (Table, Modal, Drawer, Form, Upload,
Select, DatePicker, Dropdown, Pagination). Tailwind supplies the visual
language. AntD's appearance is overridden through a design-token theme in
`src/theme/antdTheme.ts`, so the result does not read as a stock AntD app.

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build
npm run lint
```

The app opens on `/login`. Any credentials sign in — the form is prefilled and
simulated. `Sign in with Microsoft` takes the same path.

## Design system

Tokens live in `src/styles/globals.css` under `@theme`, and are mirrored into
the AntD theme so both systems stay in step.

| Role | Value |
| --- | --- |
| Primary red | `#D71920` |
| Dark red | `#A90F15` |
| Soft red | `#FFF2F2` |
| Background | `#F7F8FA` |
| Surface | `#FFFFFF` |
| Primary text | `#18181B` |
| Secondary text | `#71717A` |
| Border | `#E8E8EC` |
| Success | `#16A34A` |
| Warning | `#D97706` |

Red is reserved for the active nav indicator, primary actions, urgent status,
selected controls, and small accent rules. Everything else stays white,
off-white, and neutral gray.

Type is Inter / Noto Sans Thai. Spacing follows an 8/12/16/20/24/32 rhythm;
radii stay in the 6–10px range. Shadows are used only on popovers and
dropdowns — panels rely on a 1px `#E8E8EC` border instead.

## Routes

| Path | Screen |
| --- | --- |
| `/login` | Split-screen sign-in |
| `/dashboard` | Overview |
| `/documents` | Documentation Control |
| `/tasks`, `/approvals`, `/revisions`, `/master-data`, `/help`, `/settings` | Reserved (placeholder) |

Three screens are built in full; the remaining nav targets render a scoped
placeholder rather than a dead link.

## Structure

```
src/
  components/
    common/      PageHeader, StatusBadge, CategoryTag, EmptyState, SectionTitle
    dashboard/   SummaryBlock, DocumentHealth, ApprovalQueue,
                 ActivityTimeline, RecentDocuments
    documents/   DocumentTable, DocumentDetailDrawer, DocumentFormModal,
                 RevisionModal, ApprovalTimeline, FilterBar, BulkActionBar,
                 FileTypeIcon
    layout/      Sidebar, TopHeader, NotificationMenu, Logo
  layouts/       AppLayout, AuthLayout
  pages/         Login, Dashboard, DocumentControl, Placeholder
  data/          mockDocuments, mockActivities
  types/         document.ts
  routes/        index.tsx
  theme/         antdTheme.ts
  lib/           format.ts, cn.ts
  styles/        globals.css
```

## Implemented interactions

All state is local React state — there is no backend.

- Login simulation and routing
- Search by document code or name, with a clear button
- Filter by category, department, owner, status, effective date, revision band
- Sortable columns, pagination with page-size control
- Row selection, selected count, and bulk actions (change owner, export, archive)
- Document detail drawer with information grid, current file, approval flow,
  and revision history
- New Document modal with validation, drag-and-drop upload, save-as-draft and
  submit-for-approval paths
- Create Revision flow showing the Rev.n → Rev.n+1 transition; a change summary
  and reason are required before submission
- Notifications dropdown with unread state and mark-all-read
- Command palette (⌘K / Ctrl-K) that deep-links into a document
- Skeleton loading, empty states, tooltips, and archive confirmation dialogs

## Data

`src/data/mockDocuments.ts` holds 22 realistic controlled documents spanning
every category, department, and lifecycle status, each with its own approval
chain, file metadata, and revision history. Dashboard counters are scaled to
1,284 documents so the prototype reads like a populated production register.

The system clock is pinned to **22 September 2026** (`TODAY` in
`src/lib/format.ts`) so due dates, review countdowns, and relative timestamps
stay consistent.

## Responsive behaviour

Designed for 1440 × 900. The sidebar collapses to a drawer below `lg`; table
columns drop progressively (department and effective date first, then owner,
revision, and category) so document identity and status survive to phone width.
Below `md` the status badge moves inside the document cell.
