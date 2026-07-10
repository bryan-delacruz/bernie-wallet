"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error?: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

function refresh() {
  // Las categorías alimentan también el formulario de gasto en /activity.
  revalidatePath("/categories");
  revalidatePath("/activity");
}

export async function createCategory(name: string): Promise<ActionResult> {
  const clean = name.trim();
  if (!clean) return { error: "El nombre no puede estar vacío." };
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("categories").insert({ user_id: userId, name: clean });
  if (error) return { error: "No se pudo crear la categoría." };
  refresh();
  return {};
}

export async function renameCategory(id: string, name: string): Promise<ActionResult> {
  const clean = name.trim();
  if (!clean) return { error: "El nombre no puede estar vacío." };
  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("categories")
    .update({ name: clean })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: "No se pudo renombrar." };
  refresh();
  return {};
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  // Las subcategorías se borran en cascada; los gastos quedan sin subcategoría.
  const { error } = await supabase.from("categories").delete().eq("id", id).eq("user_id", userId);
  if (error) return { error: "No se pudo eliminar." };
  refresh();
  return {};
}

export async function createSubcategory(
  categoryId: string,
  name: string,
): Promise<ActionResult> {
  const clean = name.trim();
  if (!clean) return { error: "El nombre no puede estar vacío." };
  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("subcategories")
    .insert({ user_id: userId, category_id: categoryId, name: clean });
  if (error) return { error: "No se pudo crear la subcategoría." };
  refresh();
  return {};
}

export async function renameSubcategory(id: string, name: string): Promise<ActionResult> {
  const clean = name.trim();
  if (!clean) return { error: "El nombre no puede estar vacío." };
  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("subcategories")
    .update({ name: clean })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: "No se pudo renombrar." };
  refresh();
  return {};
}

export async function deleteSubcategory(id: string): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("subcategories")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: "No se pudo eliminar." };
  refresh();
  return {};
}
