import { useEffect, useRef, useState } from "react";
import { whatsappLink } from "../data";
import WhatsAppIcon from "./WhatsAppIcon";

// Floating WhatsApp button once the hero CTA scrolls out of view. On phones it steps aside while
// scrolling down (so it never covers what is being read) and comes back on the way up.
export default function WhatsAppFab() {
  const [show, setShow] = useState(false);
  const lastY = useRef(0);
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const pastHero = y > window.innerHeight * 0.8;
      const phone = window.innerWidth < 768;
      const goingDown = y > lastY.current + 4;
      const goingUp = y < lastY.current - 4;
      if (!pastHero) setShow(false);
      else if (!phone) setShow(true);
      else if (goingDown) setShow(false);
      else if (goingUp) setShow(true);
      if (goingDown || goingUp) lastY.current = y;
    };
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
      className={`brut press fixed bottom-4 right-4 z-50 grid h-14 w-14 place-items-center rounded-full bg-mint transition-all duration-300 md:bottom-5 md:right-5 md:h-16 md:w-16 ${show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"}`}
    >
      <WhatsAppIcon className="h-7 w-7 md:h-8 md:w-8" />
    </a>
  );
}
