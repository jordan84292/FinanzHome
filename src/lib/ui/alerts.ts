'use client';

import Swal from 'sweetalert2';

export function showError(message: string): void {
  void Swal.fire({ icon: 'error', title: 'Error', text: message });
}

export function showSuccess(message: string): void {
  void Swal.fire({ icon: 'success', title: 'Listo', text: message, timer: 2000, showConfirmButton: false });
}

export async function confirmAction(message: string): Promise<boolean> {
  const result = await Swal.fire({
    icon: 'question',
    title: '¿Confirmar?',
    text: message,
    showCancelButton: true,
    confirmButtonText: 'Sí',
    cancelButtonText: 'Cancelar',
  });
  return result.isConfirmed;
}
