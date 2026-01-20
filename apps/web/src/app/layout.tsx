import type { Metadata, Viewport } from 'next';
import { ToastProvider } from '@/components/ui/Toast';
import './globals.css';

export const metadata: Metadata = {
  title: 'Poker Rooms | Free-to-Play Online Poker',
  description: 'Create private poker rooms with custom rules. Play Texas Hold\'em, Omaha, Blackjack and more with friends.',
  keywords: ['poker', 'online poker', 'texas holdem', 'omaha', 'blackjack', 'free poker'],
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1a0a2e',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">
        <ToastProvider>
          <div className="min-h-screen flex flex-col bg-purple-gradient">
            {children}
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
