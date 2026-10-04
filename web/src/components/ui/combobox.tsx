"use client";

import { type KeyboardEvent, useId, useState } from "react";
import { Input } from "./form";

// Minúsculas e sem acentos (NFD separa a letra do diacrítico, que então sai).
function normalize(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

// Filtro do combobox (AD-032): o texto em qualquer posição, ignorando maiúsculas e acentos, na
// ordem recebida e no máximo `max` opções. Texto em branco não sugere nada.
export function matchOptions(options: string[], text: string, max: number): string[] {
  if (text.trim() === "") return [];
  const needle = normalize(text);
  return options.filter((option) => normalize(option).includes(needle)).slice(0, max);
}

// Texto livre com sugestões, no padrão ARIA 1.2 "combobox com lista" (AD-032). Fica dentro de um
// <Field>, que dá o id e o rótulo ao <Input>.
export function Combobox({
  value,
  onChange,
  options,
  maxOptions = 8,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  maxOptions?: number;
}) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const matches = open ? matchOptions(options, value, maxOptions) : [];
  const expanded = matches.length > 0;
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  function choose(option: string) {
    onChange(option);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const candidates = matchOptions(options, value, maxOptions);
      if (candidates.length === 0) return;
      event.preventDefault();
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (current + step + candidates.length) % candidates.length);
    } else if (event.key === "Enter" && expanded && active >= 0) {
      // Escolher a sugestão não envia o formulário.
      event.preventDefault();
      choose(matches[active]);
    } else if (event.key === "Escape" && expanded) {
      event.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <div className="bf-combobox">
      <Input
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listboxId}
        aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
      />
      <ul id={listboxId} role="listbox" className="bf-combobox__list" hidden={!expanded}>
        {matches.map((option, index) => (
          <li
            key={option}
            id={optionId(index)}
            role="option"
            aria-selected={index === active}
            className="bf-combobox__option"
            // Mantém o foco no campo: sem isso o blur fecharia a lista antes do clique.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(option)}
          >
            {option}
          </li>
        ))}
      </ul>
    </div>
  );
}
