import LandingStory from "@/components/landing/LandingStory";
import { LANDING_DATA, validasiLandingData } from "@/lib/landing/data";

export default function HomePage() {
  validasiLandingData(LANDING_DATA);
  return <LandingStory data={LANDING_DATA} />;
}
