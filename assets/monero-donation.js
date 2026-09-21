document.querySelectorAll('.monero-donation').forEach((donation) => {
  const button = donation.querySelector('.monero-donation__copy');
  const address = donation.querySelector('.monero-donation__address');
  const status = donation.querySelector('.monero-donation__status');

  if (!navigator.clipboard?.writeText) return;
  button.hidden = false;
  button.addEventListener('click', async () => {
    status.textContent = '';
    try {
      await navigator.clipboard.writeText(address.textContent.trim());
      status.textContent = button.dataset.copied;
    } catch {
      status.textContent = button.dataset.failed;
    }
  });
});
