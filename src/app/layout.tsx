import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Evidence školení',
  description: 'Přehled zaměstnaneckých školení a plánování termínů.',
};

export default function RootLayout({children}: LayoutProps<'/'>) {
  return (
    <html lang='cs'>
    <body>{children}</body>
    </html>
  );
}
