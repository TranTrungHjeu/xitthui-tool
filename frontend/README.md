# Xitthui Teacher Dashboard (Frontend)

Modern Teacher Dashboard for MindX LMS built with Next.js 15, Shadcn UI, and Zustand.

## Features

- Interactive Class List & Filtering
- Detailed Session Analysis (Slots, Attendance, Summaries)
- Direct Evaluation/Review Updates to LMS
- Real-time Teacher Statistics
- Modern Authentication Flow

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI Components**: Shadcn UI (Tailwind CSS + Radix UI)
- **Icons**: Lucide React
- **State Management**: Zustand
- **API Client**: Axios with automatic token attachment
- **Date Utilities**: date-fns

## Getting Started

The frontend is designed to work with the Xitthui backend server.

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
