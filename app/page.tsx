import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import SolverCard from "@/components/SolverCard";
import HowItWorks from "@/components/HowItWorks";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col bg-navy">
      <Navbar />
      <HeroSection />
      <section className="px-4 sm:px-6 lg:px-8">
        <SolverCard />
      </section>
      <HowItWorks />
      <Footer />
    </main>
  );
}
