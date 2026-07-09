import "./globals.css";

export const metadata = {
  title: "Manual SAKTE",
  description: "PWA pembaca PDF SOP dengan cache offline.",
  manifest: "/manifest.webmanifest",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#18333a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
