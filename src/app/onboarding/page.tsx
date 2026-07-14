import { createHouseholdAction, acceptInvitationAction, type OnboardingActionState } from './actions';

const initialActionState: OnboardingActionState = { error: null };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;

  if (invite) {
    return (
      <main className="container-fluid px-3 py-4" style={{ maxWidth: 420 }}>
        <h1 className="h4 mb-4">Unirte al hogar</h1>
        <form
          action={async (formData: FormData) => {
            'use server';
            await acceptInvitationAction(initialActionState, formData);
          }}
          className="d-flex flex-column gap-3"
        >
          <input type="hidden" name="token" value={invite} />
          <div>
            <label htmlFor="displayName" className="form-label">Tu nombre</label>
            <input id="displayName" name="displayName" type="text" className="form-control" required />
          </div>
          <div>
            <label htmlFor="paymentDay" className="form-label">Día de pago (1-31)</label>
            <input
              id="paymentDay"
              name="paymentDay"
              type="number"
              min={1}
              max={31}
              className="form-control"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary">Unirme</button>
        </form>
      </main>
    );
  }

  return (
    <main className="container-fluid px-3 py-4" style={{ maxWidth: 420 }}>
      <h1 className="h4 mb-4">Creá tu hogar</h1>
      <form
        action={async (formData: FormData) => {
          'use server';
          await createHouseholdAction(initialActionState, formData);
        }}
        className="d-flex flex-column gap-3"
      >
        <div>
          <label htmlFor="name" className="form-label">Nombre del hogar</label>
          <input id="name" name="name" type="text" className="form-control" required />
        </div>
        <div>
          <label htmlFor="paymentDay" className="form-label">Tu día de pago (1-31)</label>
          <input
            id="paymentDay"
            name="paymentDay"
            type="number"
            min={1}
            max={31}
            className="form-control"
            required
          />
        </div>
        <button type="submit" className="btn btn-primary">Crear hogar</button>
      </form>
    </main>
  );
}
