import { Button } from "./ui/button";

function RunButton({
  label = "Run workspace",
  hint = "Launch the selected preset in order",
  shortcut = "Enter",
  onClick,
  disabled = false,
  className = "",
}) {
  return (
    <Button
      type="button"
      className={`run-button ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
      variant="default"
      size="lg"
    >
      <span className="run-button__icon" aria-hidden="true">
        RUN
      </span>

      <span className="run-button__copy">
        <span className="run-button__label">{label}</span>
        <span className="run-button__hint">{hint}</span>
      </span>

      <span className="run-button__shortcut" aria-hidden="true">
        {shortcut}
      </span>
    </Button>
  );
}

export default RunButton;
