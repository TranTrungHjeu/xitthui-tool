import type { Metadata } from "next";
import { Geist, Geist_Mono, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";

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
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={200} skipDelayDuration={300}>
            {children}
          </TooltipProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              classNames: {
                toast: "group toast bg-popover border border-border text-popover-foreground shadow-lg rounded-lg",
                title: "text-sm font-medium",
                description: "text-xs text-muted-foreground",
                actionButton: "bg-primary text-primary-foreground",
                cancelButton: "bg-muted text-muted-foreground",
              },
            }}
            richColors
            closeButton
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
