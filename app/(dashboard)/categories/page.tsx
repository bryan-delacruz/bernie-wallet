import { createClient } from "@/lib/supabase/server";
import { CategoriesManager } from "@/components/dashboard/categories-manager";

type Category = {
  id: string;
  name: string;
  subcategories: { id: string; name: string }[];
};

export default async function CategoriesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, subcategories(id, name)")
    .eq("user_id", user.id)
    .order("name");

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-medium tracking-tight">Categorías</h1>
        <p className="text-sm text-muted-foreground">
          Organiza tus gastos. Las subcategorías son las que asignas a cada gasto.
        </p>
      </div>

      <CategoriesManager categories={(categories ?? []) as Category[]} />
    </div>
  );
}
