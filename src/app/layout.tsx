import "@styles/global.css";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Connect Together",
  description: "Real-time chat rooms — connect with anyone, anywhere.",
  icons: {
    icon: "/assets/favicon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-background`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <script
            dangerouslySetInnerHTML={{
              __html: `
                try {
                  var accent = localStorage.getItem("accent-pack") || "default";
                  document.documentElement.setAttribute("data-accent", accent);
                } catch (e) {}
              `,
            }}
          />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
