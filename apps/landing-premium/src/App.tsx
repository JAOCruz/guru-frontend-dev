import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Marquee from "./components/Marquee";
import TypewriterBlock from "./components/TypewriterBlock";
import About from "./components/About";
import VideoBlock from "./components/VideoBlock";
import GuruOwl from "./components/GuruOwl";
import BriefcaseServices from "./components/BriefcaseServices";
import Testimonials from "./components/Testimonials";
import Dominican from "./components/Dominican";
import CtaBand from "./components/CtaBand";
import Location from "./components/Location";
import Footer from "./components/Footer";
import WhatsAppFab from "./components/WhatsAppFab";

// Production skeleton, reordered per Leandro: services right after the slogan,
// then the Gurú video and owl, then the typewriter with the story
export default function App() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <BriefcaseServices />
        <VideoBlock />
        <GuruOwl />
        <Marquee />
        <TypewriterBlock />
        <About />
        <Testimonials />
        <Dominican />
        <CtaBand />
        <Location />
      </main>
      <Footer />
      <WhatsAppFab />
    </>
  );
}
