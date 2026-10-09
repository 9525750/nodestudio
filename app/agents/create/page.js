import { cookies } from "next/headers";
import AgentCreateClient from "./AgentCreateClient";

const BASE_URL = 'https://api.kie.ai';

async function fetchUserData(apiKey) {
  if (!apiKey) return null;
  try {
    const res = await fetch(`${BASE_URL}/api/v1/account/balance`, {
      cache: "no-store",
      headers: { "Authorization": `Bearer ${apiKey}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function CreateAgentPage() {
  const cookieStore = await cookies();
  const apiKey = cookieStore.get("kie_api_key")?.value;

  const userData = await fetchUserData(apiKey);

  return (
    <AgentCreateClient userData={userData} />
  );
}
