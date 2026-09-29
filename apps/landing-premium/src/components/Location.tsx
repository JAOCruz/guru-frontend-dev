import { MapPin, Navigation } from "lucide-react";
import { MAPS_URL } from "../data";

const EMBED = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3784.731960779048!2d-69.9315891239499!3d18.450475282629593!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8ea5635fabab61a7%3A0x1cc6b9e0dfa32f93!2sGuru%20Soluciones!5e0!3m2!1ses-419!2sdo!4v1759434493649!5m2!1ses-419!2sdo";

export default function Location() {
  return (
    <section id="ubicacion" className="px-4 py-20 md:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="mb-3 font-display text-xs font-bold uppercase tracking-[0.25em] text-guru">Geolocalización</p>
          <h2 className="font-display text-[clamp(2rem,5vw,3.6rem)] font-black uppercase leading-none">
            ¿Dónde estamos <span className="text-guru">ubicados?</span>
          </h2>
          <div className="brut mt-8 rounded-3xl bg-paper p-6">
            <p className="flex items-start gap-3 text-lg font-bold"><MapPin className="mt-1 shrink-0 text-guru" /> Av. Independencia 1607, Santo Domingo 10101, La Feria, frente a la OGM.</p>
            <p className="mt-3 pl-9 text-ink/70"><b>Referencia:</b> entrando por el callejón del Plaspilito.</p>
            <a href={MAPS_URL} target="_blank" rel="noopener" className="brut-sm press ml-9 mt-5 inline-flex items-center gap-2 rounded-full bg-guru px-4 py-2 font-bold text-white">
              <Navigation size={16} /> Cómo llegar
            </a>
          </div>
        </div>
        <div className="brut min-h-[340px] overflow-hidden rounded-3xl bg-paper-2 shadow-[var(--shadow-hard-lg)]">
          <iframe title="Mapa de Gurú Soluciones" src={EMBED} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-full min-h-[340px] w-full border-0 grayscale-[35%] contrast-[1.05]" />
        </div>
      </div>
    </section>
  );
}
