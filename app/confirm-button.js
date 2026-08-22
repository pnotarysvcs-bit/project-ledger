'use client';

export default function ConfirmButton({ children, message, className, disabled = false }) {
  const isArchive = String(children ?? '').trim().toLowerCase() === 'archive';
  const confirmSubmit = (event, text) => {
    if (!window.confirm(text)) event.preventDefault();
  };

  if (isArchive) {
    return <>
      <button
        type="submit"
        name="intent"
        value="closed"
        className="ghost"
        disabled={disabled}
        onClick={(event) => confirmSubmit(event, 'Mark this bill Closed? Its actual recurring payment will roll to the recommended next payoff target.')}
      >
        Closed
      </button>
      <button
        type="submit"
        name="intent"
        value="archive"
        className={className}
        disabled={disabled}
        onClick={(event) => confirmSubmit(event, message)}
      >
        {children}
      </button>
    </>;
  }

  return (
    <button
      type="submit"
      className={className}
      disabled={disabled}
      onClick={(event) => confirmSubmit(event, message)}
    >
      {children}
    </button>
  );
}
