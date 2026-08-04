import { useEffect, useMemo, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { matchAreas } from "@/data/area-suggestions";

/**
 * Free-text area input with a local type-ahead dropdown.
 * Anything typed is accepted — the list is a shortcut, never a requirement.
 */
export function AreaCombobox({
  value,
  onChange,
  placeholder = "Dallas, TX",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const options = useMemo(() => matchAreas(value), [value]);
  const visible = open && options.length > 0 && !(options.length === 1 && options[0]?.label === value);

  useEffect(() => {
    if (!visible) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [visible]);

  const pick = (label: string) => {
    onChange(label);
    setOpen(false);
    setActive(0);
  };

  return (
    <div ref={wrapRef} className="relative">
      <Input
        className={`rounded-lg bg-white/[0.04] ${className}`}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={visible}
        aria-autocomplete="list"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!visible) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (i + 1) % options.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i - 1 + options.length) % options.length);
          } else if (e.key === "Enter") {
            const opt = options[active];
            if (opt) {
              e.preventDefault();
              pick(opt.label);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />

      {visible && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-white/10 bg-[oklch(0.18_0.03_290)] p-1 shadow-xl backdrop-blur"
        >
          {options.map((o, i) => (
            <li key={o.label}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o.label)}
                className={`flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                  i === active ? "bg-white/10" : "hover:bg-white/6"
                }`}
              >
                <span className="truncate">{o.label}</span>
                {o.deregulated && (
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-white/45">
                    deregulated
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
