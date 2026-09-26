"use client";

import { type FormEvent, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import type { Product, ProductBody, ProductSummary } from "@/lib/products";
import { Button } from "./ui/button";
import { Alert } from "./ui/feedback";
import { Field, Input, Select } from "./ui/form";

interface Values {
  name: string;
  modelUrl: string;
  description: string;
  modelTitle: string;
  modelImageUrl: string;
  modelDesigner: string;
  modelLicense: string;
  // Tri-estado do select: "" é não informado.
  commercialUse: "" | "true" | "false";
}

function valuesOf(product?: ProductSummary): Values {
  return {
    name: product?.name ?? "",
    modelUrl: product?.modelUrl ?? "",
    description: product?.description ?? "",
    modelTitle: product?.modelTitle ?? "",
    modelImageUrl: product?.modelImageUrl ?? "",
    modelDesigner: product?.modelDesigner ?? "",
    modelLicense: product?.modelLicense ?? "",
    commercialUse:
      product?.commercialUseAllowed === true ? "true" : product?.commercialUseAllowed === false ? "false" : "",
  };
}

const orNull = (value: string): string | null => (value.trim() === "" ? null : value.trim());

function bodyOf(values: Values): ProductBody {
  return {
    name: values.name,
    modelUrl: values.modelUrl,
    description: orNull(values.description),
    modelTitle: orNull(values.modelTitle),
    modelImageUrl: orNull(values.modelImageUrl),
    modelDesigner: orNull(values.modelDesigner),
    modelLicense: orNull(values.modelLicense),
    commercialUseAllowed: values.commercialUse === "" ? null : values.commercialUse === "true",
  };
}

// Cadastro e edição do produto (Fase 13). Os metadados do modelo são digitados; a Fase 14 os
// buscará pela URL.
export function ProductForm({
  product,
  onSaved,
  onCancel,
}: {
  // Sem `product`, cria; com ele, edita.
  product?: ProductSummary;
  onSaved: (product: Product) => void;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<Values>(() => valuesOf(product));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof Values) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const saved = await apiFetch<Product>(product ? `/products/${product.id}` : "/products", {
        method: product ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyOf(values)),
      });
      if (!product) setValues(valuesOf());
      onSaved(saved);
    } catch (cause) {
      // Os campos ficam como estão para o usuário corrigir (erro ao salvar).
      setError(cause instanceof ApiError ? cause.message : "Não foi possível conectar à API");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" aria-label={product ? "Editar produto" : "Novo produto"}>
      <div className="bf-form-grid">
        <Field label="Nome">
          <Input value={values.name} onChange={set("name")} required />
        </Field>
        <Field label="URL do modelo" hint="Printables, MakerWorld ou Thingiverse">
          <Input type="url" value={values.modelUrl} onChange={set("modelUrl")} required />
        </Field>
        <Field label="Título do modelo">
          <Input value={values.modelTitle} onChange={set("modelTitle")} />
        </Field>
        <Field label="Designer">
          <Input value={values.modelDesigner} onChange={set("modelDesigner")} />
        </Field>
        <Field label="Licença">
          <Input value={values.modelLicense} onChange={set("modelLicense")} placeholder="ex.: CC BY-NC 4.0" />
        </Field>
        <Field label="Uso comercial">
          <Select value={values.commercialUse} onChange={set("commercialUse")}>
            <option value="">Não informado</option>
            <option value="true">Permitido</option>
            <option value="false">Não permitido</option>
          </Select>
        </Field>
        <Field label="URL da imagem">
          <Input type="url" value={values.modelImageUrl} onChange={set("modelImageUrl")} />
        </Field>
        <Field label="Descrição" style={{ gridColumn: "1 / -1" }}>
          <Input value={values.description} onChange={set("description")} />
        </Field>
      </div>
      {error && (
        <Alert tone="danger" role="alert">
          {error}
        </Alert>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" loading={submitting}>
          {submitting ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
