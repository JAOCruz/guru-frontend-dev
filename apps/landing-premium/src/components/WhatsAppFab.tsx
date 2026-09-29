import { useEffect, useState } from "react";
import { whatsappLink } from "../data";
import WhatsAppIcon from "./WhatsAppIcon";

// Floating WhatsApp button once the hero CTA scrolls out of view
export default function WhatsAppFab() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 0.8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <a
      href={whatsappLink()}
      target="_blank"
      rel="noopener"
      aria-label="Escríbenos por WhatsApp"
      className={`brut press fixed bottom-5 right-5 z-50 grid h-16 w-16 place-items-center rounded-full bg-mint transition-all duration-300 ${show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"}`}
    >
      <WhatsAppIcon className="h-8 w-8" />
    </a>
  );
}
