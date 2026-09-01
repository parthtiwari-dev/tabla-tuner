import { redirect } from "next/navigation";

/** Personal tool — go straight to the thing. */
export default function Home() {
  redirect("/tune");
}
