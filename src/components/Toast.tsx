interface ToastProps {
  message: string;
  visible: boolean;
}

export default function Toast({ message, visible }: ToastProps) {
  return (
    <div className={`toast${visible ? ' toast--visible' : ''}`} role="status" aria-live="polite">
      <i className="fa-solid fa-circle-check" />
      <span>{message}</span>
    </div>
  );
}
