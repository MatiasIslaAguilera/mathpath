/** Bottom-sheet "are you sure?" used when the back gesture would throw away work. */
export function ConfirmDialog({ title, body, stay, leave, onStay, onLeave }: {
  title: string;
  body: string;
  stay: string;
  leave: string;
  onStay(): void;
  onLeave(): void;
}) {
  return (
    <div className="modal-backdrop" onClick={onStay}>
      <div className="modal confirm" role="alertdialog" aria-label={title} onClick={(e) => e.stopPropagation()} data-testid="confirm-leave">
        <h3 className="first">{title}</h3>
        <p>{body}</p>
        <div className="confirm-actions">
          <button className="btn primary" onClick={onStay} data-testid="confirm-stay">
            {stay}
          </button>
          <button className="btn subtle" onClick={onLeave} data-testid="confirm-leave-btn">
            {leave}
          </button>
        </div>
      </div>
    </div>
  );
}
