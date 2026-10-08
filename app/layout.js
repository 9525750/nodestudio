import './globals.css';

export const metadata = {
  title: 'NodeStudio — AI Generation Studio',
  description: 'Self-hosted AI image, video, audio, and lip sync studio powered by Kie.ai',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-studio-bg min-h-screen">{children}</body>
    </html>
  );
}
