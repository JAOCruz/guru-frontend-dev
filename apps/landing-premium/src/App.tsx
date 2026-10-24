import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Marquee from "./components/Marquee";
import TypewriterBlock from "./components/TypewriterBlock";
import About from "./components/About";
import VideoBlock from "./components/VideoBlock";
import Templates from "./components/Templates";
import BriefcaseServices from "./components/BriefcaseServices";
import Testimonials from "./components/Testimonials";
import Dominican from "./components/Dominican";
import CtaBand from "./components/CtaBand";
import Location from "./components/Location";
import Footer from "./components/Footer";
import WhatsAppFab from "./components/WhatsAppFab";
import ConsentBanner from "./components/ConsentBanner";

// Order per Leandro: cover (slogan + the owl's delivery flight), who we are, the templates window,
// the services briefcase, the typewriter story, the Gurú group video, testimonials, where we are, the rest
export default function App() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <About />
        <Templates />
        <BriefcaseServices />
        <TypewriterBlock />
        <VideoBlock />
        <Marquee />
        <Testimonials />
        <Location />
        <Dominican />
        <CtaBand />
      </main>
      <Footer />
      <WhatsAppFab />
      <ConsentBanner />
    </>
  );
}
