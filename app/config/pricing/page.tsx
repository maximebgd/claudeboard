import { redirect } from "next/navigation";

// Les tarifs d'estimation ont été fusionnés dans la page Préférences.
export default function PricingRedirect() {
  redirect("/config/preferences");
}
