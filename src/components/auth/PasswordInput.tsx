'use client';

import { useId, useState } from 'react';

export function PasswordInput({
  label,
  name,
  minLength,
}: {
  label: string;
  name: string;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className="form-label">{label}</label>
      <div className="input-group">
        <span className="input-group-text">
          <i className="bi bi-lock-fill" />
        </span>
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          className="form-control"
          required
          minLength={minLength}
        />
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          <i className={`bi ${visible ? 'bi-eye-slash' : 'bi-eye'}`} />
        </button>
      </div>
    </div>
  );
}
