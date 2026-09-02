import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Jourkalender – Excel till kalender',
  description:
    'Skapa en kalenderfil med dina primär- och bakjourer direkt från klinikens Excel-schema.',
  openGraph: {
    title: 'Jourkalender',
    description: 'Excel till kalender',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Jourkalender – Excel till kalender' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Jourkalender',
    description: 'Excel till kalender',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv">
      <body>{children}</body>
    </html>
  );
}
