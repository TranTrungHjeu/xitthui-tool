import type { Metadata } from "next";
import { Geist, Geist_Mono, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MindX Support Tools",
  description: "MindX LMS dashboard dành cho giáo viên",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        jetbrainsMono.variable,
      )}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground flex flex-col" suppressHydrationWarning>
        <TooltipProvider delayDuration={200} skipDelayDuration={300}>
          {children}
        </TooltipProvider>
        <Toaster
            position="top-right"
            duration={4500}
            visibleToasts={5}
            gap={10}
            offset={16}
            toastOptions={{
              unstyled: false,
              classNames: {
                toast:
                  "group toast relative w-[360px] max-w-[calc(100vw-2rem)] flex items-start gap-3 px-4 py-3.5 rounded-xl border bg-popover text-popover-foreground shadow-xl shadow-black/5 backdrop-blur-sm ring-1 ring-black/[0.02] dark:ring-white/[0.04]",
                title: "text-[13px] font-semibold leading-tight tracking-tight",
                description: "text-xs text-muted-foreground leading-relaxed mt-0.5",
                actionButton:
                  "h-7 px-3 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors",
                cancelButton:
                  "h-7 px-3 text-xs font-medium rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors",
                closeButton:
                  "absolute right-2 top-2 left-auto translate-x-0 bg-transparent border-0 text-muted-foreground/60 hover:text-foreground hover:bg-transparent transition-colors",
                icon: "shrink-0 mt-0.5",
                success:
                  "!border-emerald-500/30 [&_[data-icon]]:text-emerald-600 dark:[&_[data-icon]]:text-emerald-400",
                error:
                  "!border-rose-500/30 [&_[data-icon]]:text-rose-600 dark:[&_[data-icon]]:text-rose-400",
                info:
                  "!border-sky-500/30 [&_[data-icon]]:text-sky-600 dark:[&_[data-icon]]:text-sky-400",
                warning:
                  "!border-amber-500/30 [&_[data-icon]]:text-amber-600 dark:[&_[data-icon]]:text-amber-400",
                loading:
                  "[&_[data-icon]]:text-muted-foreground border-border",
              },
            }}
            icons={{
              success: (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/10">
                  <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                </span>
              ),
              error: (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-500/10">
                  <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </span>
              ),
              info: (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sky-500/10">
                  <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                </span>
              ),
              warning: (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/10">
                  <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3l10 18H2L12 3z" />
                    <path d="M12 9v4M12 17h.01" />
                  </svg>
                </span>
              ),
              loading: (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-muted">
                  <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3 animate-spin text-muted-foreground" stroke="currentColor" strokeWidth={3}>
                    <path d="M12 3a9 9 0 0 1 9 9" />
                  </svg>
                </span>
              ),
            }}
            closeButton
            richColors={false}
          />
        </body>
    </html>
  );
}
