document.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch('/api/reports/summary');
    const result = await response.json();

    if (result.success) {
      document.getElementById('total-books').textContent = result.data?.totalBooks || 0;
      document.getElementById('total-users').textContent = result.data?.totalUsers || 0;
      document.getElementById('active-loans').textContent = result.data?.activeLoans || 0;
    }
  } catch (error) {
    console.error('Error al cargar reportes:', error);
  }
});