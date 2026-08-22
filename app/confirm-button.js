'use client';

export default function ConfirmButton({ children, message, className, disabled = false }) {
  const isArchive = String(children ?? '').trim().toLowerCase() === 'archive';
  const buttonLabel = isArchive ? 'Closed' : children;
  const confirmation = isArchive
    ? 'Mark this bill Closed? Its actual recurring payment will roll to the recommended next payoff target.'
    : message;

  return (
    <button
      type="submit"
      className={className}
      disabled={disabled}
      onClick={(event) => {
        if (!window.confirm(confirmation)) event.preventDefault();
      }}
    >
      {buttonLabel}
    </button>
  );
}
