import { redirect } from "next/navigation";

/** No landing page first: the site opens the kitchen's Today. The story about Laituri lives at /about. */
export default async function Home({ searchParams }: PageProps<"/">) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const one of Array.isArray(value) ? value : [value ?? ""]) params.append(key, one);
  }
  const query = params.toString();
  redirect(query ? `/buyer?${query}` : "/buyer");
}
