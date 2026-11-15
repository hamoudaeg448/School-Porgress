import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";

const plex = IBM_Plex_Sans_Arabic({
  subsets: ["latin", "arabic"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata = {
  title: "School Progress",
  description: "Student progress by term, year and subject",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={plex.className}>{children}</body>
    </html>
  );
}
