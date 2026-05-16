/**
 * public/js/table-export.js
 * Shared client-side utility for exporting any HTML table to CSV or PDF.
 *
 * Usage:
 *   1. Add a `data-export-table` attribute to the table or its container.
 *   2. Add an inline config block:
 *        <script type="application/json" data-export-config="myTable">
 *          {"title":"My Table","filename":"my_table","excludeColumns":["Actions"]}
 *        </script>
 *   3. Add buttons: <button class="btn-export-csv" data-for="myTable">Export CSV</button>
 *                     <button class="btn-export-pdf" data-for="myTable">Export PDF</button>
 *   4. Call `initTableExport()` on DOMContentLoaded.
 */

/**
 * Read the export config for a given table id.
 * Looks for <script type="application/json" data-export-config="{id}">
 * Falls back to defaults.
 */
function getExportConfig(tableId) {
  const script = document.querySelector(`script[data-export-config="${tableId}"]`);
  if (script) {
    try {
      return JSON.parse(script.textContent);
    } catch (_) {}
  }
  return { title: tableId, filename: tableId, excludeColumns: [] };
}

/**
 * Extract visible column headers from a <table>.
 * @returns {string[]}
 */
function getHeaders(table) {
  const ths = table.querySelectorAll('thead th');
  return Array.from(ths).map((th) => th.textContent.trim());
}

/**
 * Extract all visible rows from a <table>, optionally excluding columns.
 * Returns an array of objects keyed by their column header text.
 */
function getRows(table, excludedCols) {
  const ths = table.querySelectorAll('thead th');
  const excludeSet = new Set(
    excludedCols.map((s) => (s || '').trim().toLowerCase())
  );

  const headerIndexes = [];
  const headerLabels = [];
  ths.forEach((th, i) => {
    const label = th.textContent.trim();
    if (!excludeSet.has(label.toLowerCase())) {
      headerIndexes.push(i);
      headerLabels.push(label);
    }
  });

  const rows = [];
  table.querySelectorAll('tbody tr').forEach((tr) => {
    // Skip hidden rows (used for client-side pagination / filtering)
    if (tr.classList.contains('hidden')) return;

    const tds = tr.querySelectorAll('td');
    const rowObj = {};
    headerIndexes.forEach((colIdx, labelIdx) => {
      rowObj[headerLabels[labelIdx]] =
        tds[colIdx]?.textContent.trim() || '';
    });
    rows.push(rowObj);
  });

  return rows;
}

/**
 * Trigger a CSV file download from a string.
 */
function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Escape a CSV field value.
 */
function escapeCsvField(field) {
  if (field == null) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build a CSV string from headers[] and rows[].
 */
function buildCsv(headers, rows) {
  const lines = [
    headers.map(escapeCsvField).join(','),
    ...rows.map((row) => headers.map((h) => escapeCsvField(row[h])).join(',')),
  ];
  return lines.join('\n');
}

/**
 * Export table data to CSV — client-side.
 */
function exportTableCsv(table, config) {
  const headers = getHeaders(table);
  const rows = getRows(table, config.excludeColumns || []);
  if (rows.length === 0) {
    alert('No data to export.');
    return;
  }
  const csv = buildCsv(headers, rows);
  const dateSuffix = new Date().toISOString().split('T')[0];
  const fn = `${config.filename || 'export'}_${dateSuffix}.csv`;
  downloadCsv('\uFEFF' + csv, fn); // BOM for Excel
}

/**
 * Export table data to PDF — server-side via POST /api/table/export.
 */
async function exportTablePdf(table, config) {
  const headers = getHeaders(table);
  const rows = getRows(table, config.excludeColumns || []);
  if (rows.length === 0) {
    alert('No data to export.');
    return;
  }

  try {
    const csrfToken = document
      .querySelector('meta[name="csrf-token"]')
      ?.getAttribute('content');
    const headers_fetch = { 'Content-Type': 'application/json' };
    if (csrfToken) headers_fetch['X-CSRF-Token'] = csrfToken;

    const apiUrl = `/api/table/export?format=pdf`;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: headers_fetch,
      body: JSON.stringify({
        tableId: config.tableId || null,
        headers,
        rows,
        title: config.title || 'Export',
        filename: config.filename || 'export',
        excludeColumns: config.excludeColumns || [],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Export failed.');
      return;
    }

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    const dateSuffix = new Date().toISOString().split('T')[0];
    a.download = `${config.filename || 'export'}_${dateSuffix}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    console.error('PDF export error:', err);
    alert('PDF export failed. Please try again.');
  }
}

/**
 * Attach click handlers to all rows of the export UI on the page.
 * Buttons:
 *   .btn-export-csv[data-for="tableId"]
 *   .btn-export-pdf[data-for="tableId"]
 *
 * Also registers window.exportTable(format, tableId) for pages that
 * prefer inline onclick handlers.
 */
function initTableExport() {
  // --- Auto-wire .btn-export-csv / .btn-export-pdf buttons ---------------
  document
    .querySelectorAll('[data-for]')
    .forEach((btn) => {
      const tableId = btn.getAttribute('data-for');
      const table = document.getElementById(tableId);
      if (!table) return;

      const format = btn.classList.contains('btn-export-csv') ? 'csv' : 'pdf';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const config = getExportConfig(tableId);
        config.tableId = tableId;
        if (format === 'csv') {
          exportTableCsv(table, config);
        } else {
          exportTablePdf(table, config);
        }
      });
    });

  // --- Also expose window.exportTable(csv|pdf, tableId) for inline onclick
  window.exportTable = function (format, tableId) {
    const table = document.getElementById(tableId);
    if (!table) {
      alert('Table not found: ' + tableId);
      return;
    }
    const config = getExportConfig(tableId);
    config.tableId = tableId;
    if (format === 'csv') {
      exportTableCsv(table, config);
    } else {
      exportTablePdf(table, config);
    }
  };
}

// Auto-init on DOMContentLoaded if on a dashboard/admin page
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTableExport);
} else {
  initTableExport();
}
