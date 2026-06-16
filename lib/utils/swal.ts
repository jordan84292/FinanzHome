import Swal from 'sweetalert2';

export const swal = {
  success: (message: string, title = 'Éxito') => {
    return Swal.fire({
      icon: 'success',
      title,
      text: message,
      confirmButtonColor: 'var(--og-gold)',
      timer: 3000,
      timerProgressBar: true,
    });
  },

  error: (message: string, title = 'Error') => {
    return Swal.fire({
      icon: 'error',
      title,
      text: message,
      confirmButtonColor: 'var(--og-gold)',
    });
  },

  warning: (message: string, title = 'Advertencia') => {
    return Swal.fire({
      icon: 'warning',
      title,
      text: message,
      confirmButtonColor: 'var(--og-gold)',
    });
  },

  info: (message: string, title = 'Información') => {
    return Swal.fire({
      icon: 'info',
      title,
      text: message,
      confirmButtonColor: 'var(--og-gold)',
    });
  },

  confirm: async (message: string, title = '¿Estás seguro?') => {
    const result = await Swal.fire({
      icon: 'question',
      title,
      text: message,
      showCancelButton: true,
      confirmButtonColor: 'var(--og-gold)',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, continuar',
      cancelButtonText: 'Cancelar',
    });
    return result.isConfirmed;
  },

  confirmDanger: async (message: string, title = '¿Estás seguro?') => {
    const result = await Swal.fire({
      icon: 'warning',
      title,
      text: message,
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    });
    return result.isConfirmed;
  },

  loading: (message = 'Cargando...') => {
    return Swal.fire({
      title: 'Cargando...',
      text: message,
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });
  },

  close: () => {
    Swal.close();
  },
};

export default swal;