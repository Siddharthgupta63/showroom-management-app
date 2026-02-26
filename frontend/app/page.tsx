import { redirect } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";

export default function Home() {
  if (typeof window !== "undefined") {
    if (isLoggedIn()) {
      redirect("/dashboard");
    } else {
      redirect("/login");
    }
  }
  return null;
}
