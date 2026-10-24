---
version: alpha
name: Integritas private dashboard
description: An evidence-led commercial intelligence desk, with an orbital world view and gold glass client folders.
colors:
  background: "#0A0A0A"
  surface: "#111111"
  primary: "#D4AF37"
  secondary: "#C5A46E"
  foreground: "#F7F5F0"
  muted: "#A9A39A"
  warning: "#D9A597"
typography:
  display:
    fontFamily: "Playfair Display, Georgia, serif"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
  utility:
    fontFamily: "ui-monospace, SFMono-Regular, monospace"
rounded:
  control: "5px"
  panel: "9px"
  dialog: "10px"
spacing:
  page: "35px"
  panel: "20px"
  gap: "15px"
components:
  button:
    minHeight: "44px"
  card:
    borderRadius: "9px"
---

# Integritas dashboard design

## Overview

The private CRM is a commercial intelligence desk for an analyst reviewing cross-border clients, evidence, verification and DD reports. The public marketing site retains its brand register. `/crm` is a product surface; clarity and durable records take precedence over decoration.

The signature is the large orbital globe, followed immediately by a single DD composer. Gold glass folders reveal evidence on hover/focus and open a two-action popup. The remaining interface stays quiet, with one navigation rail and compact operational typography. Do not recreate a landing-page hero or put a second mock dashboard sidebar inside the application.

The owner-approved Z.ai review and implementation plan is preserved in the task outputs. The actual selected upstream repository is `bilawalsidhu/gods-eye-view`, pinned in `vendor/gods-eye-view/PROVENANCE.json`. Reference adaptations do not import mock authentication, synthetic risk ratings or browser-local business state.

Token ownership is Model B: `app/globals.css` remains canonical for brand colours and active font variables. This document mirrors those values. `components/dashboard/dashboard.css` maps the private product roles and responsive layouts; shared Radix UI primitives retain interaction ownership. No public-site rebrand is included.

## Colors

Charcoal and near-black give evidence room to breathe. Ivory carries primary content; muted text is secondary information, not the sole indication of an error. Gold marks focus, the main action and the folder material. Warning and risk states use text and semantic indicators in addition to colour. There is one dark theme; forced-colour and print styles retain meaning.

## Typography

Use the Site's self-hosted Integritas Body (Inter), Integritas Display (Cormorant) and Integritas Capitals (Cinzel) faces. The previous Next font variables emitted broken absolute font URLs; the runtime tokens now point directly to the existing self-hosted brand files. Monospace is reserved for gate codes, hashes and identifiers. Sentence case labels and tabular numerals support scanning. The current UI is English, with dates shown in `en-ZA` and operational times explicitly SAST. Do not introduce Poppins from the prototype.

## Layout

Desktop: 225px sidebar and a fluid main column, capped at 1580px. Main padding is 35px; typical panel padding 20px and grid gaps 15px. Sidebar narrows at 1150px, then becomes horizontally accessible navigation at 760px. Metrics become two columns; folder and entity cards become one column on narrow phones. Each table owns horizontal overflow; forms retain natural document height.

Overview order: world view, DD composer, four scoped indicators, activity/pipeline charts, latest three DD investigations. Show more opens the complete client register. Case evidence, gate verification, worker progress and report publication have distinct states.

## Elevation & Depth

Use tonal surfaces and a thin gold border. Glass belongs to folder pockets; it is not a treatment for every panel. Dialogs use the existing portal/backdrop and focus contract. No ambient pulsing status or generated imagery may imply live evidence.

## Shapes

Controls use 5px corners, panels 9px and dialogs 10px. The globe remains circular within a stable rectangular viewport. Folder silhouettes and the small orb are the expressive exceptions.

## Components

Canonical actions use `.dash-button`; data filters use the existing authored Radix Select owner. Dialogs, tabs and their keyboard/focus behaviours come from `components/ui`. Tables remain semantic. Search has an immediate clear action; loading, no-results, error and stale data are distinct.

Folder actions are exactly Open folder and Open gates & issues. Its evidence papers are hidden at rest and revealed by hover/focus. Touch opens the same popup. Motion is limited to short interaction transitions and respects reduced motion. Lucide icons supplement labels; icon-only buttons have accessible names.

The sidebar, cards, directory, graph and exports share one authorized projection. Numbers derive from records, charts state what they count, and missing values remain unknown. The globe's accessible location list is available without WebGL. Source and feed freshness are stated independently of the worker's readiness.

## Do's and Don'ts

- Do preserve the existing private session, evidence revisions and paired-report release gates.
- Do show a concrete next action and preserve input through recoverable failures.
- Do keep risk, evidence confidence, opportunity and capacity separate.
- Do not merge identities by similar name or invent coordinates, ratings or progress.
- Do not treat a heartbeat, fixture or completed worker stage as full live acceptance.
