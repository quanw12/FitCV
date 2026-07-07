Design a complete, modern, high-fidelity web application UI kit called **"FitCV"** — an AI-powered CV screening and job readiness platform with two portals: **Job Seeker Portal** and **HR Recruiter Portal**. Generate 13 connected screens as a single cohesive design system, desktop-first (1440px width), responsive-ready, in the visual style of clean SaaS products like **Notion, Linear, and LinkedIn Talent** — professional, trustworthy, data-driven, but friendly and approachable for students.

## 🎨 DESIGN SYSTEM (apply consistently across all 13 screens)

**Color Palette:**
- Primary: Deep indigo/blue (#4F46E5 or similar) — represents trust, tech, AI
- Secondary/Accent: Vibrant teal or emerald green (#10B981) — for success, match scores, positive states
- Warning/Gap: Amber/orange (#F59E0B) — for skill gaps, pending states
- Danger: Soft red (#EF4444) — for rejections, low scores
- Neutral background: Off-white (#F9FAFB) for canvas, white (#FFFFFF) for cards
- Text: Dark slate (#111827) for headings, gray (#6B7280) for secondary text
- Use soft gradients (indigo → violet) for hero sections and score rings

**Typography:**
- Headings: Inter or Poppins, Bold/SemiBold
- Body: Inter, Regular/Medium
- Clear hierarchy: H1 (32px), H2 (24px), H3 (18px), Body (14-16px), Caption (12px)

**Layout & Components:**
- Left sidebar navigation (icons + labels) fixed on all authenticated screens, collapsible
- Top header bar with search, notifications bell, user avatar dropdown
- Rounded corners (12-16px radius) on all cards, buttons, inputs
- Soft drop shadows for elevation (cards, modals, dropdowns)
- Circular progress rings and horizontal progress bars for match scores / percentages
- Badge/chip components for skill tags (color-coded: green = matched skill, orange = missing skill)
- Data visualization: use donut charts, bar charts, and line charts (like Recharts style) for analytics
- Icon set: use a consistent line-icon style (like Lucide/Feather icons) throughout
- Empty states with friendly illustrations where relevant
- Consistent spacing system (8px grid)

**Overall Vibe:** Clean, minimal, generous white space, data made visually digestible, feels premium yet accessible for students AND corporate HR users. Avoid clutter — every screen should have clear visual hierarchy with one primary CTA.

---

## 📱 SCREEN 1 — Authentication & Role Selection (Shared)
A split-screen login/register page. Left side: branded illustration/gradient panel with the FitCV logo and tagline "Know your fit before you apply." Right side: clean auth form with tabs for Login/Register, email + password fields, "Continue with Google" button, and a role-selection step showing 2 large clickable cards side-by-side: **"I am a Job Seeker"** (icon: person with resume) and **"I am a Recruiter"** (icon: briefcase/magnifying glass over documents). Include a "Forgot password?" link and minimal footer.

## 📱 SCREEN 2 — Job Seeker Dashboard
Sidebar nav (Dashboard, Match Analyzer, Improvement Tips, CV History, Application Tracker, JD Library, Profile). Top header with greeting "Welcome back, [Name]". Main content: 3 stat cards in a row (CVs Analyzed, Average Match Score with circular progress ring, Applications Tracked). Below: a highlighted banner card "Your CV is in the top 20% for Backend Developer roles" with a trophy/star icon. Below that: a "Recent Activity" feed/timeline showing last analyzed JD and last improvement tips, with a "Continue Analysis" CTA button. Include a quick-action floating button "+ New Analysis".

## 📱 SCREEN 3 — CV & JD Match Analyzer
Two-column upload interface: left card "Upload your CV" (drag-and-drop zone, PDF/DOCX icon, file preview), right card "Paste or Upload Job Description" (text area + upload option). Below, a large "Analyze with AI" primary button. Results section (shown as scrolled/expanded state): a large circular score ring in the center (e.g. "78% Match") surrounded by 4 smaller breakdown cards: Skills, Experience, Education, Soft Skills — each with a mini progress bar. Below: a highlighted callout card "68% chance of passing this JD's screening round" with a probability gauge/speedometer visual.

## 📱 SCREEN 4 — AI CV Improvement Suggestions
Left sidebar: table of contents (Skill Gap Report, Work Experience, Skills, Education, Summary, Quick Wins). Main content area organized in expandable sections/accordion cards. "Skill Gap Report" section: list of missing skills as orange badge chips sorted by priority. "Section Feedback" area: before/after comparison cards showing a weak bullet point in gray strikethrough style next to an AI-rewritten version in green highlight, with a "Problem → Action → Result" label tag. Bottom: a "Quick Wins Checklist" card with checkbox items (missing keywords, formatting issues, length problems), each with a checkmark or warning icon.

## 📱 SCREEN 5 — CV History & Version Comparison
A grid/list of CV version cards (e.g. "CV_v1_Marketing.pdf", "CV_v2_Dev.pdf") each showing thumbnail preview, upload date, and match score badge. A "Compare" toggle lets user select 2 versions to view side-by-side comparison, with a line chart at the top showing "Score Improvement Over Time" (x-axis = versions/dates, y-axis = match score %). Include an "Upload New Version" button.

## 📱 SCREEN 6 — Application Tracker
A kanban-style or table view toggle. Table view: columns for Company (with logo placeholder), Position, Date Applied, Source (tag: LinkedIn/TopCV/Other), Status (colored pill: Applied/Screening/Interview/Offer/Rejected), and a notes icon. Include a filter/search bar at top and a "+ Add Application" button. Show a reminder badge/icon on rows with no update after X days (e.g. small orange clock icon). Include a status summary bar chart at the top showing count per stage.

## 📱 SCREEN 7 — JD Library & Market Insights
Top section: grid of JD cards previously analyzed (job title, company, match score badge, date). Below: a "Market Insights" analytics section with a horizontal bar chart "Skills appearing most across your analyzed JDs" and a second chart "Skills you're missing most often" highlighted in orange, framed as a "Learning Roadmap" card with numbered priority list and small icons per skill (e.g. Docker, SQL, Communication).

## 📱 SCREEN 8 — HR Dashboard
Sidebar nav for HR portal (Dashboard, Job Posts, CV Ranking, Pipeline, Auto Email, Reports). Top header with company/recruiter name. Main content: row of stat cards (Active Job Posts, Total CVs Reviewed, Avg. Candidate Score, Review Progress %). Below: a table/list of "Active Job Posts" each showing title, CV count badge, average score, and a progress bar for review completion. Quick action buttons at top-right: "Upload CVs", "Create Job Post", "View Pipeline".

## 📱 SCREEN 9 — Job Post Management
A form-based screen for creating/editing a JD: title field, department dropdown, JD text area (with an "AI Auto-Extract Requirements" button that populates a side panel showing extracted skill tags, experience level, education requirements). A "Scoring Weights" section with 3 sliders (Skills %, Experience %, Education %) that visually sum to 100% in a stacked bar. Bottom: a "Shareable JD Link" card with a copy-link button and QR code icon, plus a list/table of all existing job posts with status (Active/Archived) toggle switches.

## 📱 SCREEN 10 — CV Upload, Parsing & AI Ranking
Top: large drag-and-drop bulk upload zone ("Drop CVs here or browse — PDF/DOCX"). Below: a ranked table/list of candidates sorted by AI score (highest first), each row showing avatar placeholder, name, score badge (color-coded: green 80%+, amber 50-79%, red <50%), and mini skill-match tags. Clicking a row opens a side panel / split view: left = parsed structured data (name, contact, skills list, experience timeline, education), right = original CV document preview (PDF viewer style).

## 📱 SCREEN 11 — Candidate Pipeline (Kanban)
A full kanban board with 6 columns: New → In Review → Shortlisted → Interview → Offer → Rejected. Each column has a candidate card (avatar, name, score badge, position applied for) that appears draggable. Cards have a small comment-count icon and status-history icon. Clicking a card opens a detail modal with notes/comments thread and a "Move to next stage" button that visually suggests triggering an email draft.

## 📱 SCREEN 12 — Auto Email & Smart Reply
Left panel: template library list (Confirmation, Shortlist, Rejection, Interview Invite) as selectable cards with icons. Main area: an AI-drafted email preview in a card styled like an email client — subject line, recipient, body text with highlighted personalized phrases referencing the candidate's CV strengths (shown in a subtle highlight color). Below: 3-step visual workflow indicator "AI Drafts → HR Reviews → HR Approves & Sends" with a checkmark progression. Bottom-right: "Approve & Send" primary button and "Bulk Send to Filtered Group" secondary option, plus small analytics icons for open/click tracking.

## 📱 SCREEN 13 — Reports & Analytics
A dashboard-style analytics page with 4 chart cards in a 2x2 grid: (1) Line chart "Applications Over Time", (2) Donut chart "Pass Rate", (3) Bar chart "Score Distribution", (4) Horizontal bar "Source Breakdown" (LinkedIn/TopCV/Referral etc). Top-right: date-range filter and an "Export to CSV/Excel" button with a download icon. Bottom: a small metrics strip showing "Avg. Time-to-Shortlist" and other KPI numbers in card format.

---

### 🔗 GENERAL INSTRUCTIONS FOR FIGMA AI
- Keep consistent sidebar, header, and spacing across all 13 screens so they feel like one connected product.
- Use realistic placeholder data (Vietnamese and English names/companies are fine).
- Make Job Seeker Portal screens (2-7) feel encouraging and personal (softer, more colorful accents).
- Make HR Portal screens (8-13) feel efficient and data-dense but still clean (more tables, more charts).
- Prioritize clarity of the AI-score visualizations (rings, gauges, bars) since that's the core value prop.
- Output as low-to-mid fidelity wireframes first is acceptable, but aim for visually polished UI similar to Notion/Linear quality if possible.
