import { redirect } from "next/navigation";

// The pages live inline on the Plans screen now (no more split-pane tagger).
export default async function PagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/projects/${id}`);
}
