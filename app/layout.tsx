import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import SearchFab from "@/components/SearchFab";
import { getEffectiveSubscription } from "@/lib/subscription";

// Lecture du système de fichiers (abonnement) au moment de la requête.
export const dynamic = "force-dynamic";

/* Space Grotesk : voix UI/titres — géométrique, technique, un peu de caractère.
   JetBrains Mono : voix « instrument » — tous les chiffres, chemins, eyebrows. */
const sans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Claudeboard",
  description:
    "Dashboard local pour visualiser et éditer votre configuration Claude Code qui est dans ~/.claude",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const subscription = await getEffectiveSubscription();
  return (
    <html lang="fr" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Applique le thème avant le premier rendu pour éviter tout flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('theme')==='light')document.documentElement.classList.add('light')}catch(e){}})()`,
          }}
        />
      </head>
      <body className="antialiased">
        <div className="flex h-screen overflow-hidden">
          <Sidebar subscription={{ label: subscription.label, known: subscription.known }} />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
        <SearchFab />
      </body>
    </html>
  );
}
