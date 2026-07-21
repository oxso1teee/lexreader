"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function deleteWord(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("vocabulary_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/notebook");
}

export async function markKnown(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("vocabulary_items")
    .update({ status: "known" })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/notebook");
}
