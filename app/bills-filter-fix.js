'use client';

import { useEffect } from 'react';

const normalize = (value) => String(value ?? '').trim().toLowerCase();

export default function BillsFilterFix() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const exactFilters = [
      { key: 'f_type', column: 1 },
      { key: 'f_account', column: 3 },
      { key: 'f_status', column: 7 },
    ].map((filter) => ({ ...filter, value: normalize(params.get(filter.key)) }))
      .filter((filter) => filter.value);

    if (!exactFilters.length) return;

    document.querySelectorAll('section.panel').forEach((section) => {
      const table = section.querySelector('table');
      if (!table) return;

      let visibleRows = 0;
      let lastPrimaryVisible = true;

      table.querySelectorAll('tbody > tr').forEach((row) => {
        if (row.classList.contains('inline-detail')) {
          row.hidden = !lastPrimaryVisible;
          return;
        }

        const cells = row.querySelectorAll(':scope > td');
        if (cells.length < 9) return;

        const matches = exactFilters.every(({ column, value }) => normalize(cells[column]?.textContent) === value);
        row.hidden = !matches;
        lastPrimaryVisible = matches;
        if (matches) visibleRows += 1;
      });

      section.hidden = visibleRows === 0;
      const count = section.querySelector(':scope > header > span');
      if (count) count.textContent = `${visibleRows} ${visibleRows === 1 ? 'occurrence' : 'occurrences'}`;
    });
  }, []);

  return null;
}
