const isMac = globalThis.navigator?.platform?.includes("Mac") ?? false;
const primaryModifier = isMac ? "Meta" : "Ctrl";
const modifiers = ["Ctrl", "Alt", "Shift", "Meta"];

export const defaultCanvasShortcuts = {
  group: `${primaryModifier}+KeyG / Alt+KeyG`,
  mergeGroup: isMac ? "Alt+Meta+KeyG" : "Ctrl+Alt+KeyG",
  ungroup: isMac ? "Shift+Meta+KeyG / Alt+Shift+KeyG" : "Ctrl+Shift+KeyG / Alt+Shift+KeyG",
  addNode: "Tab",
  copyOnDrag: "Alt",
  duplicateOnDrag: isMac ? "Alt+Meta" : "Ctrl+Alt",
  pan: "Space",
  zoom: "Ctrl",
  moveTool: "KeyV",
  handTool: "KeyH",
  arrange: "Alt+Shift+KeyF",
  search: `${primaryModifier}+KeyF`,
  delete: "Backspace",
  copy: `${primaryModifier}+KeyC`,
  paste: `${primaryModifier}+KeyV`,
  undo: `${primaryModifier}+KeyZ`,
  redo: isMac ? "Shift+Meta+KeyZ" : "Ctrl+Shift+KeyZ",
  zoomIn: isMac ? "Meta+Equal / Shift+Meta+Equal" : "Ctrl+Equal / Ctrl+Shift+Equal",
  zoomOut: `${primaryModifier}+Minus`,
  fitView: `${primaryModifier}+Digit0`,
};
export type CanvasShortcutAction = keyof typeof defaultCanvasShortcuts;
export type CanvasShortcuts = Record<CanvasShortcutAction, string>;

export const canvasShortcutFields: {
  id: CanvasShortcutAction;
  label: string;
  hold?: boolean;
  gesture?: "drag" | "wheel";
}[] = [
  { id: "group", label: "Group" },
  { id: "mergeGroup", label: "Merge group" },
  { id: "ungroup", label: "Ungroup" },
  { id: "addNode", label: "Add node" },
  { id: "copyOnDrag", label: "Copy node", hold: true, gesture: "drag" },
  { id: "duplicateOnDrag", label: "Duplicate", hold: true, gesture: "drag" },
  { id: "zoomIn", label: "Zoom in" },
  { id: "zoomOut", label: "Zoom out" },
  { id: "fitView", label: "Fit to canvas" },
  { id: "zoom", label: "Mouse wheel", hold: true, gesture: "wheel" },
  { id: "pan", label: "Keyboard and mouse", hold: true },
  { id: "moveTool", label: "Move" },
  { id: "handTool", label: "Hand tool" },
  { id: "arrange", label: "Arrange canvas" },
  { id: "undo", label: "Undo" },
  { id: "redo", label: "Redo" },
  { id: "search", label: "Search canvas nodes" },
  { id: "delete", label: "Delete" },
  { id: "copy", label: "Copy to clipboard" },
  { id: "paste", label: "Paste nodes" },
];

const keyLabels: Record<string, string> = {
  Ctrl: "Ctrl", Alt: "Alt", Shift: "Shift", Meta: isMac ? "⌘" : "Win",
  Space: "Space", Escape: "Esc", Enter: "Enter", Tab: "Tab", Backspace: "⌫", Delete: "Delete",
  ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓",
  Home: "Home", End: "End", PageUp: "PageUp", PageDown: "PageDown", Insert: "Insert",
  Minus: "−", Equal: "+", BracketLeft: "[", BracketRight: "]", Backslash: "\\",
  Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/", Backquote: "`",
  CapsLock: "CapsLock", NumLock: "NumLock", ScrollLock: "ScrollLock", Pause: "Pause", PrintScreen: "PrintScreen",
  NumpadAdd: "Numpad +", NumpadSubtract: "Numpad -", NumpadMultiply: "Numpad *", NumpadDivide: "Numpad /",
  NumpadDecimal: "Numpad .", NumpadEnter: "Numpad Enter", NumpadEqual: "Numpad =",
};

export function normalizeShortcut(value: string): string | undefined {
  if (!value.trim()) return "";
  const bindings = value.split("/").map(normalizeBinding);
  if (bindings.some(binding => binding === undefined)) return;
  return [...new Set(bindings)].join(" / ");
}

function normalizeBinding(value: string): string | undefined {
  const parts = value.split("+").map(part => part.trim());
  if (new Set(parts).size !== parts.length) return;
  const keys = parts.filter(part => !modifiers.includes(part));
  if (keys.length > 1 || keys.some(key => !Object.hasOwn(keyLabels, key) && !/^(?:Key[A-Z]|Digit\d|Numpad\d|F(?:[1-9]|1\d|2[0-4]))$/.test(key))) return;
  return [...modifiers.filter(modifier => parts.includes(modifier)), ...keys].join("+");
}

export function getShortcutBindings(binding: string) {
  return binding.split("/").map(value => value.trim()).filter(Boolean);
}

export function isModifierShortcut(binding: string) {
  return !!binding && binding.split("+").every(part => modifiers.includes(part));
}

export function isShortcutAllowed(field: typeof canvasShortcutFields[number], binding: string) {
  return getShortcutBindings(binding).every(value => field.gesture === "drag"
    ? isModifierShortcut(value) : field.hold || !isModifierShortcut(value));
}

export function shortcutFromEvent(event: KeyboardEvent) {
  const modifier = ["Control", "Alt", "Shift", "Meta"].includes(event.key);
  return [event.ctrlKey && "Ctrl", event.altKey && "Alt", event.shiftKey && "Shift", event.metaKey && "Meta", !modifier && event.code]
    .filter(Boolean).join("+");
}

export function shortcutMatches(event: KeyboardEvent, binding: string) {
  return !!binding && event.type !== "keyup" && getShortcutBindings(binding).includes(shortcutFromEvent(event));
}

export function shortcutPressed(event: Pick<KeyboardEvent, "ctrlKey" | "altKey" | "shiftKey" | "metaKey">, binding: string, pressedCodes: ReadonlySet<string>) {
  return getShortcutBindings(binding).some(value => {
    const parts = value.split("+");
    if (event.ctrlKey !== parts.includes("Ctrl") || event.altKey !== parts.includes("Alt")
      || event.shiftKey !== parts.includes("Shift") || event.metaKey !== parts.includes("Meta")) return false;
    const key = parts.find(part => !modifiers.includes(part));
    return !key || pressedCodes.has(key);
  });
}

export function shortcutLabel(binding: string) {
  return getShortcutBindings(binding).map(value => value.split("+")
    .map(part => keyLabels[part] ?? part.replace(/^(?:Key|Digit)/, "").replace(/^Numpad/, "Numpad ")).join(" + ")).join(" / ");
}
