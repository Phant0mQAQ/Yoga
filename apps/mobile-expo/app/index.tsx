import { Redirect } from "expo-router";
import { Loading } from "@/components/ui";
import { useSession } from "@/state/session";

export default function Index() {
  const session = useSession();

  if (!session.ready) return <Loading />;
  if (!session.role) return <Redirect href="/(auth)" />;
  if (session.role === "student") return <Redirect href="/(student)" />;
  if (session.role === "coach") return <Redirect href="/(coach)" />;
  if (session.role === "staff") return <Redirect href="/(staff)" />;
  return <Redirect href="/(admin)" />;
}
