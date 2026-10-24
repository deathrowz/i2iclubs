import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { ActivityHeartbeat } from '@/components/ActivityHeartbeat';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'I2I Clubs (Idea2Impact) | Sri Lanka School Circular Index (15-School Pilot)',
  description:
    'Tracking verified school waste recycled (kg), student enterprise sales (Rs.), and top-off seed funding across 15 participating Sri Lankan schools.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${plusJakarta.variable}`}>
      <body className="min-h-screen bg-[#E6F1FA] text-[#111010] antialiased selection:bg-[#9CF2F2] selection:text-[#005FA3]">
        <ActivityHeartbeat />
        {children}
      </body>
    </html>
  );
}
