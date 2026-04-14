"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";

interface SelectFilterOption {
    value: string;
    label: string;
}

interface SelectFilterProps {
    value: string;
    onChange: (value: string) => void;
    options: SelectFilterOption[];
    className?: string;
    /** "sm" = filtros de tabla (py-1.5 text-xs) | "md" = formularios (py-2 text-sm) */
    size?: "sm" | "md";
    disabled?: boolean;
    error?: boolean;
    placeholder?: string;
}

export default function SelectFilter({
    value,
    onChange,
    options,
    className = "",
    size = "sm",
    disabled = false,
    error = false,
    placeholder,
}: SelectFilterProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
    const wrapperRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const selected = options.find(o => o.value === value);
    const displayLabel = selected?.label ?? placeholder ?? options[0]?.label ?? "";

    const updatePosition = () => {
        if (!wrapperRef.current) return;
        const rect = wrapperRef.current.getBoundingClientRect();
        // Open upward if not enough space below
        const spaceBelow = window.innerHeight - rect.bottom;
        const estimatedHeight = Math.min(options.length * 36 + 8, 240);
        const openUp = spaceBelow < estimatedHeight + 8 && rect.top > estimatedHeight + 8;
        setDropdownStyle({
            position: "fixed",
            ...(openUp
                ? { bottom: window.innerHeight - rect.top + 4 }
                : { top: rect.bottom + 4 }),
            left: rect.left,
            minWidth: rect.width,
            zIndex: 99999,
        });
    };

    useEffect(() => {
        if (isOpen) updatePosition();
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handleReposition = () => updatePosition();
        window.addEventListener("scroll", handleReposition, true);
        window.addEventListener("resize", handleReposition);
        return () => {
            window.removeEventListener("scroll", handleReposition, true);
            window.removeEventListener("resize", handleReposition);
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handleClick = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                wrapperRef.current && !wrapperRef.current.contains(target) &&
                listRef.current && !listRef.current.contains(target)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [isOpen]);

    const dropdown = isOpen && !disabled ? (
        <div
            ref={listRef}
            style={{ ...dropdownStyle, color: "#404040", fontFamily: "inherit" }}
            className="bg-white border border-neutral-200 rounded-lg shadow-xl overflow-y-auto max-h-60 py-1"
        >
            {options.map(opt => {
                const isSelected = opt.value === value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left whitespace-nowrap ${isSelected ? "font-medium" : "text-neutral-700"}`}
                        style={isSelected ? { backgroundColor: "rgba(191,75,80,0.1)", color: "#bf4b50" } : undefined}
                        onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = "rgba(191,75,80,0.1)";
                            e.currentTarget.style.color = "#bf4b50";
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = isSelected ? "rgba(191,75,80,0.1)" : "";
                            e.currentTarget.style.color = isSelected ? "#bf4b50" : "";
                        }}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            onChange(opt.value);
                            setIsOpen(false);
                        }}
                    >
                        <span>{opt.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 ml-3 flex-shrink-0" style={{ color: "#bf4b50" }} />}
                    </button>
                );
            })}
        </div>
    ) : null;

    return (
        <div ref={wrapperRef} className={`relative inline-flex ${className}`}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => { if (!disabled) setIsOpen(prev => !prev); }}
                className={`w-full flex items-center justify-between gap-2 px-3 border rounded-lg bg-white transition-colors outline-none
                    ${size === "md" ? "py-2 text-sm" : "py-1.5 text-xs"}
                    ${disabled
                        ? "bg-neutral-100 text-neutral-400 border-neutral-200 cursor-not-allowed opacity-60"
                        : error
                            ? isOpen
                                ? "border-red-400 ring-2 ring-red-400/30 text-neutral-700"
                                : "border-red-400 text-neutral-700 hover:border-red-500"
                            : isOpen
                                ? "border-[#bf4b50] ring-2 ring-[#bf4b50]/30 text-[#bf4b50]"
                                : "border-neutral-200 text-neutral-700 hover:border-[#bf4b50]/50 hover:text-[#bf4b50]"
                    }`}
            >
                <span className={`truncate ${!selected && placeholder ? "text-neutral-400" : ""}`}>
                    {displayLabel}
                </span>
                <ChevronDown
                    className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
            </button>
            {typeof document !== "undefined" && createPortal(dropdown, document.body)}
        </div>
    );
}
