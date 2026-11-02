interface PromptItemProps {
  name: string;
  text: string;
  current: boolean;
  onSelect(): void;
}

export function PromptItem({ name, text, current, onSelect }: PromptItemProps) {
  return (
    <button type="button" className="prompt-item" aria-pressed={current} onClick={onSelect}>
      <span className="prompt-name">{name}</span>
      <span className="prompt-text">{text}</span>
    </button>
  );
}
