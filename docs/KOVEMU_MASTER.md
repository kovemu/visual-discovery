# KOVEMU_MASTER.md

# KOVEMU Master Direction

> **Kovemu is a Discovery Platform with creator support.**

## Core Philosophy

-   Search is a feature, not the product.
-   Discovery is the product.
-   Users should discover creators they did not know before.
-   The goal is to make users browse, click, and eventually support
    creators.

------------------------------------------------------------------------

## Product Identity

Kovemu combines the strengths of:

-   **Steam** → Discovery structure
-   **Pinterest** → Visual exploration
-   **Ko-fi** → Creator support

Kovemu is **not** a copy of these services. It is a discovery platform
focused on introducing Korean creators to global audiences.

------------------------------------------------------------------------

## UX Principles

### Home

Home is a curated experience, not a search results page.

Order:

1.  Hero (Featured Creator)
2.  Navigation
3.  Discover Picks
4.  Rising Creators
5.  Categories
6.  Popular
7.  Recently Supported

### Navigation

Top Header

-   Logo
-   Search
-   Login / Join

Hero

Navigation below Hero:

-   Discover
-   Popular
-   Rankings
-   Categories (Dropdown only)

Rules:

-   Logo returns Home
-   Search is not a menu item
-   Categories is the only dropdown
-   Popular and Rankings use filters instead of dropdowns

------------------------------------------------------------------------

## Design Principles

-   Large visuals
-   Minimal text
-   Plenty of whitespace
-   Creator-first
-   Story before statistics

Cards should emphasize curiosity, not information overload.

------------------------------------------------------------------------

## Creator Card

Display only:

-   Cover Image
-   Creator Name
-   Category
-   Short tagline
-   Support button

Avoid:

-   Long descriptions
-   Excessive metrics
-   Multiple social links

------------------------------------------------------------------------

## Technical Direction

Stack

-   Next.js (App Router)
-   Tailwind CSS
-   shadcn/ui
-   Framer Motion
-   Lucide Icons

Component-first architecture.

------------------------------------------------------------------------

## Product Rule

Whenever making a design decision, ask:

1.  Would Steam do this?
2.  How can we make it more human-centered?

------------------------------------------------------------------------

## Team Roles

CEO / Product Vision: - User

Product Design / UX / Technical Lead: - ChatGPT

Challenge ideas when necessary. Do not agree by default.

------------------------------------------------------------------------

## Long-term Goal

Become the best platform for discovering Korean creators worldwide.

People should visit Kovemu not because they know who to search for, but
because they want to discover someone new.
