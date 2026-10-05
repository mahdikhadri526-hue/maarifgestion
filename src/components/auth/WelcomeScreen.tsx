import logo from "@/assets/logo.jpeg";
import type { WelcomePhoto } from "@/lib/welcomePhotos";

type Props = { photo?: WelcomePhoto; backdrop?: WelcomePhoto; stage?: "logo" | "welcome"; isLastPhoto?: boolean };

export function WelcomeScreen({ photo, backdrop, stage = "welcome", isLastPhoto = false }: Props) {
  if (photo) {
    return (
      <main className="relative h-dvh w-screen overflow-hidden bg-background" aria-label="Photos de bienvenue">
        <img key={photo.id} src={photo.url} alt="Photo Oliveri" className={`welcome-photo absolute inset-0 h-full w-full object-cover${isLastPhoto ? " welcome-photo-last" : ""}`} />
      </main>
    );
  }
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-7 overflow-hidden bg-background px-6 text-center" aria-label="Bienvenue">
      {backdrop && <img src={backdrop.url} alt="" aria-hidden className="welcome-photo-bg welcome-backdrop absolute inset-0 h-full w-full object-cover" />}
      {backdrop && <div aria-hidden className="welcome-veil absolute inset-0" />}
      <img src={logo} alt="Logo Oliveri" className="welcome-logo relative h-28 w-28 rounded-full border border-card/80 object-cover shadow-xl sm:h-32 sm:w-32" />
      {stage === "welcome" && (
        <h1 className={`welcome-message relative max-w-md text-xl font-semibold leading-relaxed sm:text-2xl${backdrop ? " welcome-card" : ""}`}>
          Bienvenue à votre espace de gestion
        </h1>
      )}

    </main>
  );
}
