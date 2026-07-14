'use client';

import { useActionState } from 'react';
import { registerAction, type RegisterActionState } from './actions';

const initialState: RegisterActionState = { error: null };

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(registerAction, initialState);

  return (
    <main className="container-fluid px-3 py-4" style={{ maxWidth: 420 }}>
      <h1 className="h4 mb-4">Crear cuenta</h1>
      <form action={formAction} className="d-flex flex-column gap-3">
        <div>
          <label htmlFor="name" className="form-label">Nombre</label>
          <input id="name" name="name" type="text" className="form-control" required />
        </div>
        <div>
          <label htmlFor="email" className="form-label">Correo</label>
          <input id="email" name="email" type="email" className="form-control" required />
        </div>
        <div>
          <label htmlFor="password" className="form-label">Contraseña</label>
          <input
            id="password"
            name="password"
            type="password"
            className="form-control"
            required
            minLength={8}
          />
        </div>
        {state.error ? (
          <div className="alert alert-danger py-2 mb-0" role="alert">
            {state.error}
          </div>
        ) : null}
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>
    </main>
  );
}
