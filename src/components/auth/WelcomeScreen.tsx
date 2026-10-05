import logo from "@/assets/logo.jpeg";

export function WelcomeScreen() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-7 bg-background px-6 text-center" aria-label="Bienvenue">
      <img
        src={logo}
        alt="Logo Oliveri"
        className="welcome-logo h-28 w-28 rounded-full border border-border object-cover shadow-md sm:h-32 sm:w-32"
      />
      <h1 className="welcome-message max-w-md text-xl font-semibold leading-relaxed text-foreground sm:text-2xl">
        Bienvenue à votre espace de gestion
      </h1>
    </main>
  );
}