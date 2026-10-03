import { useEffect, useRef, type ReactNode } from "react";
import logo from "@/assets/logo.jpeg";
import { cn } from "@/lib/utils";

interface PageTitleProps {
  title: string;
  subtitle?: ReactNode;
  className?: string;
}

export function PageTitle({ title, subtitle, className }: PageTitleProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = rootRef.current?.parentElement?.parentElement;
    if (!section) return;
    const hideDuplicate = () => {
      const content = section.querySelector<HTMLElement>(".page-module-content");
      if (!content) return;
      const duplicate = Array.from(content.querySelectorAll<HTMLElement>("h2"))
        .find((heading) => heading.textContent?.trim().replace(/\s+/g, " ") === title);
      duplicate?.classList.add("sr-only");
    };
    hideDuplicate();
    const observer = new MutationObserver(hideDuplicate);
    observer.observe(section, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [title]);

  return (
    <div ref={rootRef} className={cn("flex min-w-0 items-center gap-3", className)}>
      <img
        src={logo}
        alt="Logo Oliveri"
        className="h-11 w-11 shrink-0 rounded-full border border-border object-cover sm:h-12 sm:w-12"
      />
      <div className="min-w-0">
        <h2 className="text-xl font-bold leading-tight text-foreground sm:text-2xl">
          {title}
        </h2>
        {subtitle ? (
          <div className="mt-1 text-sm text-muted-foreground sm:text-base">{subtitle}</div>
        ) : null}
      </div>
    </div>
  );
}