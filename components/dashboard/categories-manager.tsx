"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createCategory,
  renameCategory,
  deleteCategory,
  createSubcategory,
  renameSubcategory,
  deleteSubcategory,
} from "@/app/(dashboard)/categories/actions";

type Subcategory = { id: string; name: string };
type Category = { id: string; name: string; subcategories: Subcategory[] };

export function CategoriesManager({ categories }: { categories: Category[] }) {
  const [newName, setNewName] = useState("");
  const [pending, startTransition] = useTransition();

  function addCategory() {
    const name = newName.trim();
    if (!name) return;
    startTransition(async () => {
      const res = await createCategory(name);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      setNewName("");
      toast.success("Categoría creada");
    });
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addCategory();
        }}
        className="flex gap-2"
      >
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nueva categoría"
        />
        <Button type="submit" disabled={pending || !newName.trim()}>
          <Plus className="size-4" />
          Agregar
        </Button>
      </form>

      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aún no tienes categorías. Crea la primera arriba.
        </p>
      ) : (
        <ul className="space-y-3">
          {categories.map((category) => (
            <CategoryItem key={category.id} category={category} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CategoryItem({ category }: { category: Category }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [newSub, setNewSub] = useState("");
  const [pending, startTransition] = useTransition();

  function saveName() {
    const value = name.trim();
    if (!value || value === category.name) {
      setEditing(false);
      setName(category.name);
      return;
    }
    startTransition(async () => {
      const res = await renameCategory(category.id, value);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      setEditing(false);
      toast.success("Categoría renombrada");
    });
  }

  function remove() {
    if (!confirm(`¿Eliminar "${category.name}" y sus subcategorías?`)) return;
    startTransition(async () => {
      const res = await deleteCategory(category.id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Categoría eliminada");
    });
  }

  function addSub() {
    const value = newSub.trim();
    if (!value) return;
    startTransition(async () => {
      const res = await createSubcategory(category.id, value);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      setNewSub("");
      toast.success("Subcategoría creada");
    });
  }

  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        {editing ? (
          <>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              className="h-8"
            />
            <Button size="icon-sm" variant="ghost" onClick={saveName} disabled={pending}>
              <Check className="size-4 text-primary" />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setName(category.name);
              }}
            >
              <X className="size-4" />
            </Button>
          </>
        ) : (
          <>
            <span className="flex-1 font-medium">{category.name}</span>
            <Button size="icon-sm" variant="ghost" onClick={() => setEditing(true)}>
              <Pencil className="size-4" />
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={remove} disabled={pending}>
              <Trash2 className="size-4 text-expense" />
            </Button>
          </>
        )}
      </div>

      <div className="mt-3 space-y-1.5 border-t border-border pt-3">
        {category.subcategories.map((sub) => (
          <SubcategoryRow key={sub.id} subcategory={sub} />
        ))}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            addSub();
          }}
          className="flex gap-2 pt-1"
        >
          <Input
            value={newSub}
            onChange={(e) => setNewSub(e.target.value)}
            placeholder="Nueva subcategoría"
            className="h-8"
          />
          <Button type="submit" size="sm" variant="outline" disabled={pending || !newSub.trim()}>
            <Plus className="size-3.5" />
          </Button>
        </form>
      </div>
    </li>
  );
}

function SubcategoryRow({ subcategory }: { subcategory: Subcategory }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(subcategory.name);
  const [pending, startTransition] = useTransition();

  function saveName() {
    const value = name.trim();
    if (!value || value === subcategory.name) {
      setEditing(false);
      setName(subcategory.name);
      return;
    }
    startTransition(async () => {
      const res = await renameSubcategory(subcategory.id, value);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      setEditing(false);
      toast.success("Subcategoría renombrada");
    });
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && saveName()}
          className="h-8"
        />
        <Button size="icon-sm" variant="ghost" onClick={saveName} disabled={pending}>
          <Check className="size-4 text-primary" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => {
            setEditing(false);
            setName(subcategory.name);
          }}
        >
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-2 rounded-md py-0.5 pl-2 text-sm">
      <span className="flex-1 text-muted-foreground">{subcategory.name}</span>
      <Button size="icon-sm" variant="ghost" onClick={() => setEditing(true)}>
        <Pencil className="size-3.5" />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={() =>
          startTransition(async () => {
            const res = await deleteSubcategory(subcategory.id);
            if (res?.error) {
              toast.error(res.error);
              return;
            }
            toast.success("Subcategoría eliminada");
          })
        }
        disabled={pending}
      >
        <X className="size-3.5 text-expense" />
      </Button>
    </div>
  );
}
