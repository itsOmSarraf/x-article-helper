// Popup script for X Article Extension

document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('status');
  const pageInfoEl = document.getElementById('page-info');

  try {
    // Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab && tab.url) {
      const url = tab.url;
      const match = url.match(/x\.com\/([^\/]+)\/article\/(\d+)/);
      
      if (match) {
        const username = match[1];
        const articleId = match[2];
        
        statusEl.textContent = '✓ Active';
        statusEl.classList.add('active');
        pageInfoEl.innerHTML = `
          <strong>@${username}</strong><br>
          <span style="color: #888; font-size: 12px;">Article: ${articleId}</span>
        `;
      } else {
        statusEl.textContent = '○ Inactive';
        statusEl.classList.add('inactive');
        pageInfoEl.textContent = 'Not an X article page';
      }
    }
  } catch (error) {
    statusEl.textContent = '⚠ Error';
    statusEl.classList.add('inactive');
    pageInfoEl.textContent = error.message;
  }
});

