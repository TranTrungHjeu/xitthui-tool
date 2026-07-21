# MindX Support Tools (Frontend)

Modern Teacher Dashboard for MindX LMS built with Next.js, Shadcn UI, and Zustand.

## Features

- Interactive Class List & Filtering
- Detailed Session Analysis (Slots, Attendance, Summaries)
- Direct Evaluation/Review Updates to LMS
- Real-time Teacher Statistics
- Modern Authentication Flow
- Command Palette (⌘K / Ctrl+K)
- Light / Dark theme

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI Components**: Shadcn UI (Tailwind CSS + Radix UI)
- **Icons**: Lucide React
- **State Management**: Zustand
- **API Client**: Axios with automatic token attachment
- **Date Utilities**: date-fns
- **Theming**: next-themes

## Getting Started

The frontend is designed to work with the MindX Support Tools backend server.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run in development mode:

   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

## Structure

- `/src/app`: Application routes and pages
- `/src/components`: Reusable UI components
- `/src/lib`: Core utilities (API client)
- `/src/store`: Client-side state management (Auth)
