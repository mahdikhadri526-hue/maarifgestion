import { createRoot } from "react-dom/client";
import { WelcomeScreen } from "@/components/auth/WelcomeScreen";
import type { WelcomePhoto } from "@/lib/welcomePhotos";
import "../src/index.css";

const photo: WelcomePhoto = {
  id: "preview",
  url: "https://picsum.photos/seed/oliveri/1200/1600",
} as unknown as WelcomePhoto;

const stage = new URLSearchParams(location.search).get("stage") ?? "welcome";

const element =
  stage === "photo"
    ? <WelcomeScreen photo={photo} isLastPhoto />
    : <WelcomeScreen stage={stage === "logo" ? "logo" : "welcome"} backdrop={photo} />;

createRoot(document.getElementById("root")!).render(<div className="bg-background">{element}</div>);
