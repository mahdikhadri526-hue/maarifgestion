import logo from "@/assets/logo.jpeg";
import type { WelcomePhoto } from "@/lib/welcomePhotos";

export function WelcomeScreen({ photo, logoOnly }: { photo?: WelcomePhoto; logoOnly?: boolean }) {
  if (photo) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-6" aria-label="Photos de bienvenue">
        <img key={photo.id} src={photo.url} alt="Photo de bienvenue Oliveri" className="welcome-photo max-h-[85vh] max-w-full object-contain" />
      </main>
    );
  }
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-7 bg-background px-6 text-center" aria-label={logoOnly ? undefined : "Bienvenue"}>
      <img
        src={logo}
        alt="Logo Oliveri"
        className="welcome-logo h-28 w-28 rounded-full border border-border object-cover shadow-md sm:h-32 sm:w-32"
      />
      {!logoOnly && (
        <h1 className="welcome-message max-w-md text-xl font-semibold leading-relaxed text-foreground sm:text-2xl">
          Bienvenue à votre espace de gestion
        </h1>
      )}
    </main>
  );
}
