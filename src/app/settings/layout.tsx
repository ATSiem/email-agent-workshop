import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Settings - Client Reports',
  description: 'Configure your Client Reports application settings',
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
} 