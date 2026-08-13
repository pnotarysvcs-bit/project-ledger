import { NextResponse } from 'next/server';
import { supabaseRequest } from '../../../src/supabase-server.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = String(searchParams.get('month') ?? '').trim();
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'Month must use YYYY-MM.' }, { status: 400 });
    }

    const imports = await supabaseRequest(
      `ledger_statement_imports?select=id,source_name,effective_month,status,created_at,completed_at&effective_month=eq.${month}-01&order=created_at.desc&limit=1`,
    );
    const item = imports?.[0] ?? null;
    if (!item) return NextResponse.json({ statement: null });

    const transactions = await supabaseRequest(
      `ledger_statement_transactions?select=id,match_status,payment_id&import_id=eq.${encodeURIComponent(item.id)}`,
    );
    const counts = (transactions ?? []).reduce((result, row) => {
      const key = row.match_status || 'Unknown';
      result[key] = (result[key] ?? 0) + 1;
      return result;
    }, {});

    return NextResponse.json({
      statement: {
        ...item,
        transactionCount: transactions?.length ?? 0,
        unresolvedCount: (counts.NEW ?? 0) + (counts.Unmatched ?? 0),
        matchedCount: (counts.Matched ?? 0) + (counts['Amount Variance'] ?? 0),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
