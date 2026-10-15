import { useEffect, useId, useMemo, useRef, useState } from "react";
import { UiIcon } from "../ui/icons/ui-icon";
import { ELEMENT_OPTIONS, normalizeElementText, type ElementOption } from "./elements";

/**
 * The searchable element picker: the full catalogue drops down on focus,
 * typing narrows it (accents ignored), and a text that is not in the list
 * stays allowed — the field is optional and free.
 */
export function ElementPicker({ value, onChange }: { value: string; onChange: (element: string) => void }) {
  const listId = useId();
  const labelId = useId();
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setText(value), [value]);

  const matches = useMemo(() => {
    const needle = normalizeElementText(text.trim());
    return needle === ""
      ? ELEMENT_OPTIONS
      : ELEMENT_OPTIONS.filter((option) => normalizeElementText(option.name).includes(needle));
  }, [text]);

  const type = (next: string) => {
    setText(next);
    onChange(next.trim());
    setActive(0);
    setOpen(true);
  };

  const choose = (option: ElementOption) => {
    setText(option.name);
    onChange(option.name);
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className="picker" onBlur={(event) => !event.currentTarget.contains(event.relatedTarget) && setOpen(false)}>
      <span className="visually-hidden" id={labelId}>
        Élément concerné
      </span>
      <input
        ref={inputRef}
        className="report-input"
        role="combobox"
        aria-labelledby={labelId}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        maxLength={60}
        placeholder="Tape pour rechercher : Barrière, Cupide, Banquise…"
        value={text}
        onFocus={() => setOpen(true)}
        onChange={(event) => type(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          else if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((index) => Math.min(index + 1, matches.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => Math.max(index - 1, 0));
          } else if (event.key === "Enter" && open) {
            // Never submit the form from the combobox: Enter takes the highlighted element, if any.
            event.preventDefault();
            if (matches[active]) choose(matches[active]);
          }
        }}
      />
      {text !== "" && (
        <button
          type="button"
          className="picker__clear"
          aria-label="Effacer l'élément"
          onClick={() => {
            type("");
            inputRef.current?.focus();
          }}
        >
          <UiIcon name="close" size={14} />
        </button>
      )}
      {open && (
        <div id={listId} className="picker__list" role="listbox">
          {matches.length === 0 && (
            <p className="picker__empty">Aucun élément trouvé — ton texte sera gardé tel quel.</p>
          )}
          {matches.map((option, index) => (
            <div key={option.name}>
              {(index === 0 || matches[index - 1].group !== option.group) && (
                <p className="picker__group">{option.group}</p>
              )}
              <button
                type="button"
                role="option"
                aria-selected={index === active}
                className={`picker__option ${index === active ? "is-active" : ""}`}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(option)}
              >
                {option.name}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
